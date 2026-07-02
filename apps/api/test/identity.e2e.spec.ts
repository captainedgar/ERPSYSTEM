import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PrismaClient,
  UserRole,
  type Branch,
  type BusinessSettings,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { PrismaService } from '../src/prisma/prisma.service';

interface SafeUser {
  id: string;
  companyId: string;
  branchId: string | null;
  name: string;
  email: string;
  status: string;
  role: { id: string; code: UserRole; name: string };
  branch: { id: string; code: string; name: string } | null;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

interface RegisterResponse extends AuthResponse {
  company: { id: string; name: string };
  branch: Branch;
}

interface RoleResponse {
  id: string;
  code: UserRole;
  name: string;
}

interface HttpResult<T> {
  status: number;
  body: T;
}

const TEST_PASSWORD = 'Test-password-123';
const workspaceRoot = resolve(__dirname, '../../..');
const schemaPath = resolve(
  workspaceRoot,
  'packages/database/prisma/schema.prisma',
);
const schemaName = `e2e_${process.pid}_${Date.now()}`
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, '_');
const baseDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://comercia:comercia_dev_password@localhost:5433/comercia_erp?schema=public';
const testDatabaseUrl = withSchema(baseDatabaseUrl, schemaName);

let app: INestApplication | undefined;
let prisma: PrismaService;
let apiBaseUrl = '';
let registrationCounter = 0;

describe('Identity and multi-company isolation (e2e)', () => {
  beforeAll(async () => {
    configureTestEnvironment();
    pushTestSchema();

    const { AppModule } = await import('../src/app.module');
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.listen(0, '127.0.0.1');

    apiBaseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
  }, 60_000);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app?.close();
    await dropTestSchema();
  });

  it('registers a company with its main branch, owner, roles and settings', async () => {
    const registered = await registerCompany('register');

    expect(registered.company.id).toBe(registered.user.companyId);
    expect(registered.branch.companyId).toBe(registered.company.id);
    expect(registered.branch.isMain).toBe(true);
    expect(registered.user.branchId).toBe(registered.branch.id);
    expect(registered.user.role.code).toBe(UserRole.OWNER);
    expectNoSensitiveFields(registered);

    const [company, mainBranch, owner, roles, settings, session] =
      await Promise.all([
        prisma.company.findUnique({
          where: { id: registered.company.id },
        }),
        prisma.branch.findFirst({
          where: { companyId: registered.company.id, isMain: true },
        }),
        prisma.user.findUnique({
          where: { id: registered.user.id },
          include: { role: true },
        }),
        prisma.role.findMany({
          where: { companyId: registered.company.id },
        }),
        prisma.businessSettings.findUnique({
          where: { companyId: registered.company.id },
        }),
        prisma.userSession.findFirst({
          where: { userId: registered.user.id },
        }),
      ]);

    expect(company).not.toBeNull();
    expect(mainBranch?.id).toBe(registered.branch.id);
    expect(owner?.role.code).toBe(UserRole.OWNER);
    expect(roles).toHaveLength(6);
    expect(settings?.currency).toBe('DOP');
    expect(session?.refreshTokenHash).toHaveLength(64);
    expect(session?.refreshTokenHash).not.toBe(registered.refreshToken);
  });

  it('logs in valid users and rejects invalid credentials', async () => {
    const registered = await registerCompany('login');
    const valid = await http<AuthResponse>('POST', '/auth/login', {
      email: registered.user.email,
      password: TEST_PASSWORD,
    });

    expect(valid.status).toBe(201);
    expect(valid.body.accessToken).toEqual(expect.any(String));
    expect(valid.body.refreshToken).toEqual(expect.any(String));
    expect(valid.body.user.id).toBe(registered.user.id);
    expectNoSensitiveFields(valid.body);

    const wrongPassword = await http<unknown>('POST', '/auth/login', {
      email: registered.user.email,
      password: 'Wrong-password-123',
    });
    const missingUser = await http<unknown>('POST', '/auth/login', {
      email: 'missing@example.test',
      password: TEST_PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(missingUser.status).toBe(401);
  });

  it('protects /auth/me and returns only the authenticated safe user', async () => {
    const registered = await registerCompany('me');
    const anonymous = await http<unknown>('GET', '/auth/me');
    const authenticated = await http<SafeUser>(
      'GET',
      '/auth/me',
      undefined,
      registered.accessToken,
    );

    expect(anonymous.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.id).toBe(registered.user.id);
    expect(authenticated.body.companyId).toBe(registered.company.id);
    expectNoSensitiveFields(authenticated.body);
  });

  it('rotates refresh tokens, rejects reuse and stores only their hashes', async () => {
    const registered = await registerCompany('refresh');
    const refreshed = await http<AuthResponse>('POST', '/auth/refresh', {
      refreshToken: registered.refreshToken,
    });

    expect(refreshed.status).toBe(201);
    expect(refreshed.body.accessToken).not.toBe(registered.accessToken);
    expect(refreshed.body.refreshToken).not.toBe(registered.refreshToken);
    expectNoSensitiveFields(refreshed.body);

    const reused = await http<unknown>('POST', '/auth/refresh', {
      refreshToken: registered.refreshToken,
    });
    const accessAsRefresh = await http<unknown>('POST', '/auth/refresh', {
      refreshToken: registered.accessToken,
    });
    const session = await prisma.userSession.findFirstOrThrow({
      where: { userId: registered.user.id, revokedAt: null },
    });

    expect(reused.status).toBe(401);
    expect(accessAsRefresh.status).toBe(401);
    expect(session.refreshTokenHash).toBe(
      createHash('sha256').update(refreshed.body.refreshToken).digest('hex'),
    );
  });

  it('revokes the session on logout', async () => {
    const registered = await registerCompany('logout');
    const logout = await http<{ success: boolean }>(
      'POST',
      '/auth/logout',
      undefined,
      registered.accessToken,
    );
    const meAfterLogout = await http<unknown>(
      'GET',
      '/auth/me',
      undefined,
      registered.accessToken,
    );
    const refreshAfterLogout = await http<unknown>('POST', '/auth/refresh', {
      refreshToken: registered.refreshToken,
    });
    const session = await prisma.userSession.findFirstOrThrow({
      where: { userId: registered.user.id },
    });

    expect(logout.status).toBe(201);
    expect(logout.body.success).toBe(true);
    expect(session.revokedAt).not.toBeNull();
    expect(meAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('enforces user permissions and owner management rules', async () => {
    const registered = await registerCompany('users');
    const roles = await getRoles(registered.accessToken);
    const adminRole = findRole(roles, UserRole.ADMIN);
    const cashierRole = findRole(roles, UserRole.CASHIER);
    const ownerRole = findRole(roles, UserRole.OWNER);

    const cashier = await createUser(
      registered.accessToken,
      cashierRole.id,
      registered.branch.id,
      'cashier',
    );
    const admin = await createUser(
      registered.accessToken,
      adminRole.id,
      registered.branch.id,
      'admin',
    );
    const cashierLogin = await login(cashier.email);
    const adminLogin = await login(admin.email);

    const cashierCreateAttempt = await http<unknown>(
      'POST',
      '/users',
      userPayload(ownerRole.id, registered.branch.id, 'cashier-owner'),
      cashierLogin.accessToken,
    );
    const adminOwnerAttempt = await http<unknown>(
      'POST',
      '/users',
      userPayload(ownerRole.id, registered.branch.id, 'admin-owner'),
      adminLogin.accessToken,
    );
    const adminManageOwnerAttempt = await http<unknown>(
      'PATCH',
      `/users/${registered.user.id}`,
      { name: 'Owner changed by admin' },
      adminLogin.accessToken,
    );
    const selfRoleAttempt = await http<unknown>(
      'PATCH',
      `/users/${registered.user.id}`,
      { roleId: adminRole.id },
      registered.accessToken,
    );
    const secondOwner = await http<SafeUser>(
      'POST',
      '/users',
      userPayload(ownerRole.id, registered.branch.id, 'second-owner'),
      registered.accessToken,
    );

    expect(cashierCreateAttempt.status).toBe(403);
    expect(adminOwnerAttempt.status).toBe(403);
    expect(adminManageOwnerAttempt.status).toBe(403);
    expect(selfRoleAttempt.status).toBe(400);
    expect(secondOwner.status).toBe(201);
    expect(secondOwner.body.role.code).toBe(UserRole.OWNER);
    expectNoSensitiveFields(secondOwner.body);
  });

  it('supports listing, reading, updating and disabling company users safely', async () => {
    const registered = await registerCompany('user-crud');
    const roles = await getRoles(registered.accessToken);
    const sellerRole = findRole(roles, UserRole.SELLER);
    const created = await createUser(
      registered.accessToken,
      sellerRole.id,
      registered.branch.id,
      'seller',
    );

    const list = await http<SafeUser[]>(
      'GET',
      '/users',
      undefined,
      registered.accessToken,
    );
    const detail = await http<SafeUser>(
      'GET',
      `/users/${created.id}`,
      undefined,
      registered.accessToken,
    );
    const updated = await http<SafeUser>(
      'PATCH',
      `/users/${created.id}`,
      { name: 'Vendedor actualizado' },
      registered.accessToken,
    );
    const disabled = await http<SafeUser>(
      'PATCH',
      `/users/${created.id}/status`,
      { status: 'INACTIVE' },
      registered.accessToken,
    );

    expect(list.status).toBe(200);
    expect(list.body.map(({ companyId }) => companyId)).toEqual([
      registered.company.id,
      registered.company.id,
    ]);
    expect(detail.status).toBe(200);
    expect(updated.body.name).toBe('Vendedor actualizado');
    expect(disabled.body.status).toBe('INACTIVE');
    expectNoSensitiveFields([
      list.body,
      detail.body,
      updated.body,
      disabled.body,
    ]);
  });

  it('isolates users, branches, company data and settings between companies', async () => {
    const companyA = await registerCompany('tenant-a');
    const companyB = await registerCompany('tenant-b');

    const usersA = await http<SafeUser[]>(
      'GET',
      '/users',
      undefined,
      companyA.accessToken,
    );
    const userBFromA = await http<unknown>(
      'GET',
      `/users/${companyB.user.id}`,
      undefined,
      companyA.accessToken,
    );
    const branchBFromA = await http<unknown>(
      'PATCH',
      `/branches/${companyB.branch.id}`,
      { name: 'Cross-company update' },
      companyA.accessToken,
    );
    const companyMine = await http<{ id: string }>(
      'GET',
      '/companies/me',
      undefined,
      companyA.accessToken,
    );
    const settingsMine = await http<BusinessSettings>(
      'GET',
      '/business-settings',
      undefined,
      companyA.accessToken,
    );

    expect(usersA.body).toHaveLength(1);
    expect(usersA.body[0]?.companyId).toBe(companyA.company.id);
    expect(userBFromA.status).toBe(404);
    expect(branchBFromA.status).toBe(404);
    expect(companyMine.body.id).toBe(companyA.company.id);
    expect(companyMine.body.id).not.toBe(companyB.company.id);
    expect(settingsMine.body.companyId).toBe(companyA.company.id);
  });

  it('creates, lists and updates only branches owned by the company', async () => {
    const companyA = await registerCompany('branches-a');
    const companyB = await registerCompany('branches-b');
    const created = await http<Branch>(
      'POST',
      '/branches',
      { name: 'Sucursal Norte', code: 'NORTH' },
      companyA.accessToken,
    );
    const updated = await http<Branch>(
      'PATCH',
      `/branches/${created.body.id}`,
      { name: 'Sucursal Norte Actualizada' },
      companyA.accessToken,
    );
    const branches = await http<Branch[]>(
      'GET',
      '/branches',
      undefined,
      companyA.accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.companyId).toBe(companyA.company.id);
    expect(updated.body.name).toBe('Sucursal Norte Actualizada');
    expect(branches.body).toHaveLength(2);
    expect(
      branches.body.every(({ companyId }) => companyId === companyA.company.id),
    ).toBe(true);
    expect(branches.body.some(({ id }) => id === companyB.branch.id)).toBe(
      false,
    );
    expect(branches.body.some(({ isMain }) => isMain)).toBe(true);
  });

  it('reads and updates only the authenticated company settings', async () => {
    const companyA = await registerCompany('settings-a');
    const companyB = await registerCompany('settings-b');
    const initial = await http<BusinessSettings>(
      'GET',
      '/business-settings',
      undefined,
      companyA.accessToken,
    );
    const updated = await http<BusinessSettings>(
      'PATCH',
      '/business-settings',
      { currency: 'usd', taxRate: 16 },
      companyA.accessToken,
    );
    const settingsB = await http<BusinessSettings>(
      'GET',
      '/business-settings',
      undefined,
      companyB.accessToken,
    );

    expect(initial.status).toBe(200);
    expect(initial.body.companyId).toBe(companyA.company.id);
    expect(updated.body.companyId).toBe(companyA.company.id);
    expect(updated.body.currency).toBe('USD');
    expect(Number(updated.body.taxRate)).toBe(16);
    expect(settingsB.body.companyId).toBe(companyB.company.id);
    expect(settingsB.body.currency).toBe('DOP');
  });
});

function configureTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = 'e2e-access-secret-that-is-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET =
    'e2e-refresh-secret-that-is-at-least-32-characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_ROUNDS = '4';
}

function pushTestSchema() {
  const prismaCli = resolve(
    workspaceRoot,
    'node_modules/prisma/build/index.js',
  );
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate'],
    {
      cwd: workspaceRoot,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    },
  );
}

async function dropTestSchema() {
  if (!/^e2e_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Refusing to drop unexpected schema: ${schemaName}`);
  }
  const cleanup = new PrismaClient({ datasourceUrl: baseDatabaseUrl });
  try {
    await cleanup.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  } finally {
    await cleanup.$disconnect();
  }
}

async function resetDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.businessSettings.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.company.deleteMany(),
  ]);
}

async function registerCompany(label: string) {
  const suffix = `${label}-${++registrationCounter}`;
  const response = await http<RegisterResponse>(
    'POST',
    '/auth/register-company',
    {
      companyName: `Empresa ${suffix}`,
      businessType: 'SMALL_STORE',
      ownerName: `Owner ${suffix}`,
      ownerEmail: `${suffix}@example.test`,
      password: TEST_PASSWORD,
    },
  );
  expect(response.status).toBe(201);
  return response.body;
}

async function getRoles(accessToken: string) {
  const response = await http<RoleResponse[]>(
    'GET',
    '/roles',
    undefined,
    accessToken,
  );
  expect(response.status).toBe(200);
  return response.body;
}

function findRole(roles: RoleResponse[], code: UserRole) {
  const role = roles.find((candidate) => candidate.code === code);
  if (!role) throw new Error(`Role ${code} was not found`);
  return role;
}

async function createUser(
  accessToken: string,
  roleId: string,
  branchId: string,
  label: string,
) {
  const response = await http<SafeUser>(
    'POST',
    '/users',
    userPayload(roleId, branchId, label),
    accessToken,
  );
  expect(response.status).toBe(201);
  expectNoSensitiveFields(response.body);
  return response.body;
}

function userPayload(roleId: string, branchId: string, label: string) {
  const suffix = `${label}-${++registrationCounter}`;
  return {
    name: `User ${suffix}`,
    email: `${suffix}@example.test`,
    password: TEST_PASSWORD,
    roleId,
    branchId,
  };
}

async function login(email: string) {
  const response = await http<AuthResponse>('POST', '/auth/login', {
    email,
    password: TEST_PASSWORD,
  });
  expect(response.status).toBe(201);
  return response.body;
}

async function http<T>(
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<HttpResult<T>> {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : undefined;
  return { status: response.status, body: parsed as T };
}

function expectNoSensitiveFields(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('passwordHash');
  expect(serialized).not.toContain('refreshTokenHash');
}

function withSchema(databaseUrl: string, schema: string) {
  const parsed = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) &&
    process.env.ALLOW_REMOTE_TEST_DATABASE !== 'true'
  ) {
    throw new Error('E2E tests require a local TEST_DATABASE_URL');
  }
  parsed.searchParams.set('schema', schema);
  return parsed.toString();
}
