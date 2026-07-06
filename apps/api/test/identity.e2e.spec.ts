import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BusinessType,
  CashMovementType,
  CashSessionStatus,
  CatalogStatus,
  CategoryType,
  CustomerDocumentType,
  CustomerStatus,
  CustomerType,
  InventoryMovementType,
  PaymentMethod,
  PrismaClient,
  SaleStatus,
  TaxpayerType,
  UserRole,
  type Branch,
  type BusinessSettings,
  type Category,
  type Customer,
  type Product,
  type Service,
  type Unit,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { PosItemType, PosSearchType } from '../src/pos/pos.types';
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

type SettingsResponse = BusinessSettings & { businessType: BusinessType };

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
    const initial = await http<SettingsResponse>(
      'GET',
      '/business-settings',
      undefined,
      companyA.accessToken,
    );
    const updated = await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { currency: 'DOP', taxRate: 16 },
      companyA.accessToken,
    );
    const settingsB = await http<SettingsResponse>(
      'GET',
      '/business-settings',
      undefined,
      companyB.accessToken,
    );

    expect(initial.status).toBe(200);
    expect(initial.body.companyId).toBe(companyA.company.id);
    expect(updated.body.companyId).toBe(companyA.company.id);
    expect(updated.body.currency).toBe('DOP');
    expect(Number(updated.body.taxRate)).toBe(16);
    expect(settingsB.body.companyId).toBe(companyB.company.id);
    expect(settingsB.body.currency).toBe('DOP');
  });

  it('allows owners and admins to update settings and rejects unauthorized users', async () => {
    const registered = await registerCompany('settings-permissions');
    const roles = await getRoles(registered.accessToken);
    const admin = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.ADMIN).id,
      registered.branch.id,
      'settings-admin',
    );
    const cashier = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.CASHIER).id,
      registered.branch.id,
      'settings-cashier',
    );
    const adminLogin = await login(admin.email);
    const cashierLogin = await login(cashier.email);

    const anonymous = await http<unknown>('GET', '/business-settings');
    const ownerUpdate = await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { receiptFooterText: 'Gracias por su compra' },
      registered.accessToken,
    );
    const adminUpdate = await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { taxRate: 18, printLogo: false },
      adminLogin.accessToken,
    );
    const cashierRead = await http<unknown>(
      'GET',
      '/business-settings',
      undefined,
      cashierLogin.accessToken,
    );
    const cashierUpdate = await http<unknown>(
      'PATCH',
      '/business-settings',
      { taxRate: 0 },
      cashierLogin.accessToken,
    );

    expect(anonymous.status).toBe(401);
    expect(ownerUpdate.status).toBe(200);
    expect(ownerUpdate.body.receiptFooterText).toBe('Gracias por su compra');
    expect(adminUpdate.status).toBe(200);
    expect(adminUpdate.body.printLogo).toBe(false);
    expect(cashierRead.status).toBe(403);
    expect(cashierUpdate.status).toBe(403);
    expect(
      await prisma.auditLog.count({
        where: {
          companyId: registered.company.id,
          action: 'BUSINESS_SETTINGS_UPDATED',
        },
      }),
    ).toBe(2);
  });

  it('applies templates and completes onboarding without crossing companies', async () => {
    const companyA = await registerCompany('template-a');
    const companyB = await registerCompany('template-b');
    const templates = await http<Array<{ id: BusinessType }>>(
      'GET',
      '/business-settings/templates',
      undefined,
      companyA.accessToken,
    );
    const applied = await http<SettingsResponse>(
      'POST',
      '/business-settings/apply-template',
      { businessType: BusinessType.MINIMARKET },
      companyA.accessToken,
    );
    const completed = await http<SettingsResponse>(
      'POST',
      '/business-settings/complete-onboarding',
      undefined,
      companyA.accessToken,
    );
    const settingsB = await http<SettingsResponse>(
      'GET',
      '/business-settings',
      undefined,
      companyB.accessToken,
    );
    const invalidTax = await http<unknown>(
      'PATCH',
      '/business-settings',
      { taxRate: 101 },
      companyA.accessToken,
    );
    const invalidPayments = await http<unknown>(
      'PATCH',
      '/business-settings',
      { enabledPaymentMethods: ['BITCOIN'] },
      companyA.accessToken,
    );
    const inconsistentDefaultPayment = await http<unknown>(
      'PATCH',
      '/business-settings',
      {
        defaultPaymentMethod: PaymentMethod.CARD,
        enabledPaymentMethods: [PaymentMethod.CASH],
      },
      companyA.accessToken,
    );
    const auditActions = await prisma.auditLog.findMany({
      where: {
        companyId: companyA.company.id,
        action: {
          in: ['BUSINESS_TEMPLATE_APPLIED', 'ONBOARDING_COMPLETED'],
        },
      },
      select: { action: true },
      orderBy: { createdAt: 'asc' },
    });

    expect(templates.status).toBe(200);
    expect(templates.body).toHaveLength(Object.values(BusinessType).length);
    expect(applied.status).toBe(201);
    expect(applied.body.businessType).toBe(BusinessType.MINIMARKET);
    expect(applied.body.posQuickSaleMode).toBe(true);
    expect(applied.body.enabledPaymentMethods).toEqual([
      PaymentMethod.CASH,
      PaymentMethod.CARD,
      PaymentMethod.TRANSFER,
    ]);
    expect(completed.status).toBe(201);
    expect(completed.body.onboardingCompleted).toBe(true);
    expect(completed.body.onboardingCompletedAt).not.toBeNull();
    expect(settingsB.body.businessType).toBe(BusinessType.SMALL_STORE);
    expect(settingsB.body.posQuickSaleMode).toBe(false);
    expect(invalidTax.status).toBe(400);
    expect(invalidPayments.status).toBe(400);
    expect(inconsistentDefaultPayment.status).toBe(400);
    expect(auditActions.map(({ action }) => action)).toEqual([
      'BUSINESS_TEMPLATE_APPLIED',
      'ONBOARDING_COMPLETED',
    ]);
  });

  it('creates, searches, updates and changes customer status with validation and audit', async () => {
    const registered = await registerCompany('customers-owner');
    const anonymous = await http<unknown>('GET', '/customers');
    const created = await http<Customer>(
      'POST',
      '/customers',
      {
        type: CustomerType.BUSINESS,
        name: 'Ferretería Central',
        commercialName: 'La Central',
        documentType: CustomerDocumentType.RNC,
        documentNumber: '1-01-12345-6',
        email: 'ventas@central.test',
        phone: '809-555-0101',
        mobile: '829-555-0102',
        address: 'Avenida Principal 10',
        city: 'Santo Domingo',
        province: 'Distrito Nacional',
        country: 'República Dominicana',
        taxpayerType: TaxpayerType.FISCAL_CONSUMER,
        paymentTermsDays: 30,
        creditLimit: 25000,
        notes: 'Cliente fiscal',
      },
      registered.accessToken,
    );
    const byName = await http<{
      items: Customer[];
      total: number;
      page: number;
      limit: number;
    }>(
      'GET',
      '/customers?search=Ferreter%C3%ADa',
      undefined,
      registered.accessToken,
    );
    const byDocument = await http<{ items: Customer[] }>(
      'GET',
      '/customers?search=101123456',
      undefined,
      registered.accessToken,
    );
    const byEmail = await http<{ items: Customer[] }>(
      'GET',
      '/customers?search=ventas%40central.test',
      undefined,
      registered.accessToken,
    );
    const updated = await http<Customer>(
      'PATCH',
      `/customers/${created.body.id}`,
      {
        name: 'Ferretería Central SRL',
        paymentTermsDays: 45,
        creditLimit: 30000,
      },
      registered.accessToken,
    );
    const inactive = await http<Customer>(
      'PATCH',
      `/customers/${created.body.id}/status`,
      { status: CustomerStatus.INACTIVE },
      registered.accessToken,
    );
    const duplicate = await http<unknown>(
      'POST',
      '/customers',
      {
        type: CustomerType.BUSINESS,
        name: 'Documento repetido',
        documentType: CustomerDocumentType.RNC,
        documentNumber: '101123456',
        taxpayerType: TaxpayerType.FISCAL_CONSUMER,
      },
      registered.accessToken,
    );
    const invalidEmail = await http<unknown>(
      'POST',
      '/customers',
      {
        type: CustomerType.INDIVIDUAL,
        name: 'Email inválido',
        documentType: CustomerDocumentType.NONE,
        email: 'correo-invalido',
        taxpayerType: TaxpayerType.FINAL_CONSUMER,
      },
      registered.accessToken,
    );
    const negativeCredit = await http<unknown>(
      'POST',
      '/customers',
      {
        type: CustomerType.INDIVIDUAL,
        name: 'Crédito inválido',
        documentType: CustomerDocumentType.NONE,
        taxpayerType: TaxpayerType.FINAL_CONSUMER,
        creditLimit: -1,
      },
      registered.accessToken,
    );
    const negativeTerms = await http<unknown>(
      'POST',
      '/customers',
      {
        type: CustomerType.INDIVIDUAL,
        name: 'Plazo inválido',
        documentType: CustomerDocumentType.NONE,
        taxpayerType: TaxpayerType.FINAL_CONSUMER,
        paymentTermsDays: -1,
      },
      registered.accessToken,
    );
    const blankName = await http<unknown>(
      'POST',
      '/customers',
      {
        ...basicCustomerPayload('   '),
      },
      registered.accessToken,
    );
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId: registered.company.id,
        entityId: created.body.id,
        action: {
          in: [
            'CUSTOMER_CREATED',
            'CUSTOMER_UPDATED',
            'CUSTOMER_STATUS_CHANGED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(anonymous.status).toBe(401);
    expect(created.status).toBe(201);
    expect(created.body.companyId).toBe(registered.company.id);
    expect(created.body.documentNumber).toBe('101123456');
    expect(Number(created.body.creditLimit)).toBe(25000);
    expect(byName.body.items.map(({ id }) => id)).toEqual([created.body.id]);
    expect(byDocument.body.items.map(({ id }) => id)).toEqual([
      created.body.id,
    ]);
    expect(byEmail.body.items.map(({ id }) => id)).toEqual([created.body.id]);
    expect(updated.body.name).toBe('Ferretería Central SRL');
    expect(updated.body.paymentTermsDays).toBe(45);
    expect(Number(updated.body.creditLimit)).toBe(30000);
    expect(inactive.body.status).toBe(CustomerStatus.INACTIVE);
    expect(duplicate.status).toBe(409);
    expect(invalidEmail.status).toBe(400);
    expect(negativeCredit.status).toBe(400);
    expect(negativeTerms.status).toBe(400);
    expect(blankName.status).toBe(400);
    expect(auditLogs.map(({ action }) => action)).toEqual([
      'CUSTOMER_CREATED',
      'CUSTOMER_UPDATED',
      'CUSTOMER_STATUS_CHANGED',
    ]);
    expect(
      auditLogs.every(
        ({ companyId, userId }) =>
          companyId === registered.company.id && userId === registered.user.id,
      ),
    ).toBe(true);
    expect(auditLogs[1]?.metadataJson).toMatchObject({
      changedFields: ['name', 'paymentTermsDays', 'creditLimit'],
    });
  });

  it('enforces customer permissions for operational roles', async () => {
    const registered = await registerCompany('customers-roles');
    const roles = await getRoles(registered.accessToken);
    const cashier = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.CASHIER).id,
      registered.branch.id,
      'customers-cashier',
    );
    const seller = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.SELLER).id,
      registered.branch.id,
      'customers-seller',
    );
    const accounting = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.ACCOUNTING).id,
      registered.branch.id,
      'customers-accounting',
    );
    const warehouse = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.WAREHOUSE).id,
      registered.branch.id,
      'customers-warehouse',
    );
    const [cashierSession, sellerSession, accountingSession, warehouseSession] =
      await Promise.all([
        login(cashier.email),
        login(seller.email),
        login(accounting.email),
        login(warehouse.email),
      ]);
    const cashierCreate = await http<Customer>(
      'POST',
      '/customers',
      basicCustomerPayload('Cliente cajero'),
      cashierSession.accessToken,
    );
    const sellerCreate = await http<Customer>(
      'POST',
      '/customers',
      basicCustomerPayload('Cliente vendedor'),
      sellerSession.accessToken,
    );
    const accountingList = await http<{ items: Customer[]; total: number }>(
      'GET',
      '/customers',
      undefined,
      accountingSession.accessToken,
    );
    const accountingUpdate = await http<Customer>(
      'PATCH',
      `/customers/${cashierCreate.body.id}`,
      { taxpayerType: TaxpayerType.FISCAL_CONSUMER },
      accountingSession.accessToken,
    );
    const cashierUpdate = await http<unknown>(
      'PATCH',
      `/customers/${cashierCreate.body.id}`,
      { name: 'Cambio no permitido' },
      cashierSession.accessToken,
    );
    const sellerStatus = await http<unknown>(
      'PATCH',
      `/customers/${sellerCreate.body.id}/status`,
      { status: CustomerStatus.INACTIVE },
      sellerSession.accessToken,
    );
    const accountingStatus = await http<unknown>(
      'PATCH',
      `/customers/${cashierCreate.body.id}/status`,
      { status: CustomerStatus.INACTIVE },
      accountingSession.accessToken,
    );
    const warehouseList = await http<unknown>(
      'GET',
      '/customers',
      undefined,
      warehouseSession.accessToken,
    );

    expect(cashierCreate.status).toBe(201);
    expect(sellerCreate.status).toBe(201);
    expect(accountingList.status).toBe(200);
    expect(accountingList.body.total).toBe(2);
    expect(accountingUpdate.status).toBe(200);
    expect(accountingUpdate.body.taxpayerType).toBe(
      TaxpayerType.FISCAL_CONSUMER,
    );
    expect(cashierUpdate.status).toBe(403);
    expect(sellerStatus.status).toBe(403);
    expect(accountingStatus.status).toBe(403);
    expect(warehouseList.status).toBe(403);
  });

  it('isolates customers by company while allowing equal documents across companies', async () => {
    const companyA = await registerCompany('customers-a');
    const companyB = await registerCompany('customers-b');
    const sharedDocument = '001-1234567-8';
    const customerA = await http<Customer>(
      'POST',
      '/customers',
      {
        ...basicCustomerPayload('Cliente empresa A'),
        documentType: CustomerDocumentType.CEDULA,
        documentNumber: sharedDocument,
      },
      companyA.accessToken,
    );
    const customerB = await http<Customer>(
      'POST',
      '/customers',
      {
        ...basicCustomerPayload('Cliente empresa B'),
        documentType: CustomerDocumentType.CEDULA,
        documentNumber: sharedDocument,
      },
      companyB.accessToken,
    );
    const customersA = await http<{ items: Customer[]; total: number }>(
      'GET',
      '/customers',
      undefined,
      companyA.accessToken,
    );
    const crossRead = await http<unknown>(
      'GET',
      `/customers/${customerB.body.id}`,
      undefined,
      companyA.accessToken,
    );
    const crossUpdate = await http<unknown>(
      'PATCH',
      `/customers/${customerB.body.id}`,
      { name: 'Cruce bloqueado' },
      companyA.accessToken,
    );

    expect(customerA.status).toBe(201);
    expect(customerB.status).toBe(201);
    expect(customerA.body.documentNumber).toBe(customerB.body.documentNumber);
    expect(customersA.body.total).toBe(1);
    expect(customersA.body.items.map(({ id }) => id)).toEqual([
      customerA.body.id,
    ]);
    expect(crossRead.status).toBe(404);
    expect(crossUpdate.status).toBe(404);
    expect(
      await prisma.customer.count({
        where: { documentNumber: customerA.body.documentNumber },
      }),
    ).toBe(2);
  });

  it('searches active POS items by type and identifier with company isolation', async () => {
    const companyA = await registerCompany('pos-search-a');
    const companyB = await registerCompany('pos-search-b');
    const category = await http<Category>(
      'POST',
      '/categories',
      { name: 'Herramientas eléctricas', type: CategoryType.BOTH },
      companyA.accessToken,
    );
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Taladro profesional',
        description: 'Taladro de impacto',
        categoryId: category.body.id,
        sku: 'POS-SKU-001',
        barcode: '7461234567890',
        price: 100,
        stock: 4,
      },
      companyA.accessToken,
    );
    const service = await http<Service>(
      'POST',
      '/services',
      {
        name: 'Instalación profesional',
        description: 'Instalación de herramientas',
        categoryId: category.body.id,
        price: 50,
      },
      companyA.accessToken,
    );
    const inactiveProduct = await http<Product>(
      'POST',
      '/products',
      { name: 'Producto POS inactivo', price: 5 },
      companyA.accessToken,
    );
    const inactiveService = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio POS inactivo', price: 5 },
      companyA.accessToken,
    );
    const foreignProduct = await http<Product>(
      'POST',
      '/products',
      { name: 'Producto empresa B', price: 10 },
      companyB.accessToken,
    );
    await http<Product>(
      'PATCH',
      `/products/${inactiveProduct.body.id}/status`,
      { status: CatalogStatus.INACTIVE },
      companyA.accessToken,
    );
    await http<Service>(
      'PATCH',
      `/services/${inactiveService.body.id}/status`,
      { status: CatalogStatus.INACTIVE },
      companyA.accessToken,
    );

    const anonymous = await http<unknown>('GET', '/pos/search-items');
    const all = await http<{
      items: Array<{ id: string; type: PosItemType; stock: string | null }>;
      total: number;
    }>(
      'GET',
      `/pos/search-items?type=${PosSearchType.ALL}`,
      undefined,
      companyA.accessToken,
    );
    const bySku = await http<{ items: Array<{ id: string }> }>(
      'GET',
      '/pos/search-items?search=POS-SKU-001&type=PRODUCT',
      undefined,
      companyA.accessToken,
    );
    const byBarcode = await http<{ items: Array<{ id: string }> }>(
      'GET',
      '/pos/search-items?search=7461234567890',
      undefined,
      companyA.accessToken,
    );
    const services = await http<{
      items: Array<{ id: string; type: PosItemType; stock: null }>;
    }>(
      'GET',
      '/pos/search-items?search=Instalaci%C3%B3n&type=SERVICE',
      undefined,
      companyA.accessToken,
    );
    const byCategory = await http<{ items: Array<{ id: string }> }>(
      'GET',
      '/pos/search-items?search=Herramientas',
      undefined,
      companyA.accessToken,
    );

    expect(anonymous.status).toBe(401);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items.map(({ id }) => id).sort()).toEqual(
      [product.body.id, service.body.id].sort(),
    );
    expect(all.body.items.map(({ id }) => id)).not.toContain(
      foreignProduct.body.id,
    );
    expect(all.body.items.map(({ id }) => id)).not.toContain(
      inactiveProduct.body.id,
    );
    expect(all.body.items.map(({ id }) => id)).not.toContain(
      inactiveService.body.id,
    );
    expect(bySku.body.items.map(({ id }) => id)).toEqual([product.body.id]);
    expect(byBarcode.body.items.map(({ id }) => id)).toEqual([product.body.id]);
    expect(services.body.items).toEqual([
      expect.objectContaining({
        id: service.body.id,
        type: PosItemType.SERVICE,
        stock: null,
      }),
    ]);
    expect(byCategory.body.items.map(({ id }) => id).sort()).toEqual(
      [product.body.id, service.body.id].sort(),
    );
  });

  it('validates a POS cart, calculates totals and never changes inventory', async () => {
    const registered = await registerCompany('pos-valid');
    const customer = await http<Customer>(
      'POST',
      '/customers',
      basicCustomerPayload('Cliente POS'),
      registered.accessToken,
    );
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Producto carrito',
        price: 100,
        taxRate: 18,
        stock: 5,
        trackInventory: true,
      },
      registered.accessToken,
    );
    const service = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio carrito', price: 50, taxRate: 18 },
      registered.accessToken,
    );
    const movementCountBefore = await prisma.inventoryMovement.count({
      where: { companyId: registered.company.id },
    });
    const validation = await http<{
      valid: boolean;
      errors: unknown[];
      customer: { id: string };
      items: Array<{
        itemId: string;
        lineSubtotal: number;
        discountAmount: number;
        taxAmount: number;
        lineTotal: number;
      }>;
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      total: number;
    }>(
      'POST',
      '/pos/validate-cart',
      {
        customerId: customer.body.id,
        items: [
          {
            itemType: PosItemType.PRODUCT,
            itemId: product.body.id,
            quantity: 2,
            discountAmount: 20,
          },
          {
            itemType: PosItemType.SERVICE,
            itemId: service.body.id,
            quantity: 1,
            discountAmount: 0,
          },
        ],
      },
      registered.accessToken,
    );
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.body.id },
    });
    const movementCountAfter = await prisma.inventoryMovement.count({
      where: { companyId: registered.company.id },
    });

    expect(validation.status).toBe(201);
    expect(validation.body.valid).toBe(true);
    expect(validation.body.errors).toEqual([]);
    expect(validation.body.customer.id).toBe(customer.body.id);
    expect(validation.body.subtotal).toBe(250);
    expect(validation.body.discountTotal).toBe(20);
    expect(validation.body.taxTotal).toBe(41.4);
    expect(validation.body.total).toBe(271.4);
    expect(validation.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: product.body.id,
          lineSubtotal: 200,
          discountAmount: 20,
          taxAmount: 32.4,
          lineTotal: 212.4,
        }),
        expect.objectContaining({
          itemId: service.body.id,
          lineSubtotal: 50,
          taxAmount: 9,
          lineTotal: 59,
        }),
      ]),
    );
    expect(Number(storedProduct.stock)).toBe(5);
    expect(movementCountAfter).toBe(movementCountBefore);
  });

  it('rejects invalid POS carts, enforces stock settings and role permissions', async () => {
    const registered = await registerCompany('pos-rules');
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Producto limitado',
        price: 10,
        stock: 1,
        trackInventory: true,
      },
      registered.accessToken,
    );
    const service = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio validación', price: 20 },
      registered.accessToken,
    );
    const invalid = await http<{
      valid: boolean;
      errors: Array<{ code: string }>;
    }>(
      'POST',
      '/pos/validate-cart',
      {
        items: [
          {
            itemType: PosItemType.PRODUCT,
            itemId: 'missing-product-id',
            quantity: 1,
            discountAmount: 0,
          },
          {
            itemType: PosItemType.SERVICE,
            itemId: 'missing-service-id',
            quantity: 1,
            discountAmount: 0,
          },
          {
            itemType: PosItemType.PRODUCT,
            itemId: product.body.id,
            quantity: 0,
            discountAmount: 0,
          },
          {
            itemType: PosItemType.SERVICE,
            itemId: service.body.id,
            quantity: 1,
            discountAmount: -1,
          },
          {
            itemType: PosItemType.SERVICE,
            itemId: service.body.id,
            quantity: 1,
            discountAmount: 21,
          },
        ],
      },
      registered.accessToken,
    );
    const insufficientStock = await validateProductCart(
      registered.accessToken,
      product.body.id,
      2,
    );
    await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { allowNegativeStock: true },
      registered.accessToken,
    );
    const allowedStock = await validateProductCart(
      registered.accessToken,
      product.body.id,
      2,
    );

    const roles = await getRoles(registered.accessToken);
    const cashier = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.CASHIER).id,
      registered.branch.id,
      'pos-cashier',
    );
    const seller = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.SELLER).id,
      registered.branch.id,
      'pos-seller',
    );
    const warehouse = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.WAREHOUSE).id,
      registered.branch.id,
      'pos-warehouse',
    );
    const [cashierSession, sellerSession, warehouseSession] = await Promise.all(
      [login(cashier.email), login(seller.email), login(warehouse.email)],
    );
    const cashierSearch = await http<unknown>(
      'GET',
      '/pos/search-items',
      undefined,
      cashierSession.accessToken,
    );
    const cashierValidation = await validateProductCart(
      cashierSession.accessToken,
      product.body.id,
      1,
    );
    const sellerSearch = await http<unknown>(
      'GET',
      '/pos/search-items',
      undefined,
      sellerSession.accessToken,
    );
    const sellerValidation = await validateProductCart(
      sellerSession.accessToken,
      product.body.id,
      1,
    );
    const warehouseSearch = await http<unknown>(
      'GET',
      '/pos/search-items',
      undefined,
      warehouseSession.accessToken,
    );
    const warehouseValidation = await validateProductCart(
      warehouseSession.accessToken,
      product.body.id,
      1,
    );
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.body.id },
    });

    expect(invalid.status).toBe(201);
    expect(invalid.body.valid).toBe(false);
    expect(invalid.body.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ITEM_NOT_AVAILABLE',
        'INVALID_QUANTITY',
        'INVALID_DISCOUNT',
        'DISCOUNT_EXCEEDS_SUBTOTAL',
      ]),
    );
    expect(insufficientStock.body.valid).toBe(false);
    expect(insufficientStock.body.errors.map(({ code }) => code)).toContain(
      'INSUFFICIENT_STOCK',
    );
    expect(allowedStock.body.valid).toBe(true);
    expect(cashierSearch.status).toBe(200);
    expect(cashierValidation.status).toBe(201);
    expect(cashierValidation.body.valid).toBe(true);
    expect(sellerSearch.status).toBe(200);
    expect(sellerValidation.status).toBe(201);
    expect(sellerValidation.body.valid).toBe(true);
    expect(warehouseSearch.status).toBe(403);
    expect(warehouseValidation.status).toBe(403);
    expect(Number(storedProduct.stock)).toBe(1);
  });

  it('creates an internal sale with mixed payments and deducts only product inventory', async () => {
    const registered = await registerCompany('sales-create');
    await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { requireOpenCashForSales: false },
      registered.accessToken,
    );
    const customer = await http<Customer>(
      'POST',
      '/customers',
      basicCustomerPayload('Cliente venta'),
      registered.accessToken,
    );
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Producto vendido',
        price: 100,
        taxRate: 18,
        stock: 5,
        trackInventory: true,
      },
      registered.accessToken,
    );
    const service = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio vendido', price: 50, taxRate: 18 },
      registered.accessToken,
    );
    const payload = {
      customerId: customer.body.id,
      items: [
        {
          itemType: PosItemType.PRODUCT,
          itemId: product.body.id,
          quantity: 2,
          discountAmount: 20,
        },
        {
          itemType: PosItemType.SERVICE,
          itemId: service.body.id,
          quantity: 1,
          discountAmount: 0,
        },
      ],
      payments: [
        { method: PaymentMethod.CASH, amount: 100 },
        {
          method: PaymentMethod.CREDIT,
          amount: 171.4,
          reference: 'Crédito interno',
        },
      ],
      notes: 'Venta mixta de prueba',
    };

    const anonymous = await http<unknown>('POST', '/sales', payload);
    const created = await http<{
      id: string;
      saleNumber: string;
      status: SaleStatus;
      subtotal: string;
      discountTotal: string;
      taxTotal: string;
      total: string;
      paidTotal: string;
      balanceDue: string;
      items: Array<{ productId: string | null; serviceId: string | null }>;
      payments: Array<{ method: PaymentMethod }>;
    }>('POST', '/sales', payload, registered.accessToken);
    const listed = await http<{
      items: Array<{ id: string; saleNumber: string }>;
      total: number;
    }>(
      'GET',
      '/sales?search=Cliente%20venta',
      undefined,
      registered.accessToken,
    );
    const detail = await http<{ id: string; notes: string }>(
      'GET',
      `/sales/${created.body.id}`,
      undefined,
      registered.accessToken,
    );
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.body.id },
    });
    const movements = await prisma.inventoryMovement.findMany({
      where: { referenceId: created.body.id },
    });
    const auditActions = (
      await prisma.auditLog.findMany({
        where: { companyId: registered.company.id, module: 'sales' },
        select: { action: true },
      })
    ).map(({ action }) => action);

    expect(anonymous.status).toBe(401);
    expect(created.status).toBe(201);
    expect(created.body.saleNumber).toMatch(/^V-\d{8}-[A-F0-9]{8}$/);
    expect(created.body.status).toBe(SaleStatus.COMPLETED);
    expect(Number(created.body.subtotal)).toBe(250);
    expect(Number(created.body.discountTotal)).toBe(20);
    expect(Number(created.body.taxTotal)).toBe(41.4);
    expect(Number(created.body.total)).toBe(271.4);
    expect(Number(created.body.paidTotal)).toBe(100);
    expect(Number(created.body.balanceDue)).toBe(171.4);
    expect(created.body.items).toHaveLength(2);
    expect(created.body.payments.map(({ method }) => method)).toEqual([
      PaymentMethod.CASH,
      PaymentMethod.CREDIT,
    ]);
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0]?.id).toBe(created.body.id);
    expect(detail.status).toBe(200);
    expect(detail.body.notes).toBe('Venta mixta de prueba');
    expect(Number(storedProduct.stock)).toBe(3);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe(InventoryMovementType.SALE_OUT);
    expect(auditActions).toEqual(
      expect.arrayContaining(['SALE_CREATED', 'SALE_STOCK_DEDUCTED']),
    );
  });

  it('blocks insufficient stock, supports configured negative stock and restores stock on cancellation', async () => {
    const registered = await registerCompany('sales-stock');
    await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { requireOpenCashForSales: false },
      registered.accessToken,
    );
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Producto con stock limitado',
        price: 10,
        taxRate: 18,
        stock: 1,
        trackInventory: true,
      },
      registered.accessToken,
    );
    const payload = salePayload(PosItemType.PRODUCT, product.body.id, 2, 23.6);
    const blocked = await http<unknown>(
      'POST',
      '/sales',
      payload,
      registered.accessToken,
    );
    const afterBlocked = await prisma.product.findUniqueOrThrow({
      where: { id: product.body.id },
    });
    await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { allowNegativeStock: true },
      registered.accessToken,
    );
    const created = await http<{ id: string; status: SaleStatus }>(
      'POST',
      '/sales',
      payload,
      registered.accessToken,
    );
    const afterSale = await prisma.product.findUniqueOrThrow({
      where: { id: product.body.id },
    });
    const roles = await getRoles(registered.accessToken);
    const cashier = await createUser(
      registered.accessToken,
      findRole(roles, UserRole.CASHIER).id,
      registered.branch.id,
      'sales-cancel-cashier',
    );
    const cashierSession = await login(cashier.email);
    const forbidden = await http<unknown>(
      'POST',
      `/sales/${created.body.id}/cancel`,
      { reason: 'Intento sin permiso' },
      cashierSession.accessToken,
    );
    const cancelled = await http<{
      status: SaleStatus;
      cancelReason: string;
    }>(
      'POST',
      `/sales/${created.body.id}/cancel`,
      { reason: 'Error en la operación' },
      registered.accessToken,
    );
    const repeated = await http<unknown>(
      'POST',
      `/sales/${created.body.id}/cancel`,
      { reason: 'Segundo intento' },
      registered.accessToken,
    );
    const restoredProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.body.id },
    });
    const movementTypes = (
      await prisma.inventoryMovement.findMany({
        where: { referenceId: created.body.id },
        orderBy: { createdAt: 'asc' },
      })
    ).map(({ type }) => type);
    const auditActions = (
      await prisma.auditLog.findMany({
        where: { companyId: registered.company.id, module: 'sales' },
        select: { action: true },
      })
    ).map(({ action }) => action);

    expect(blocked.status).toBe(400);
    expect(Number(afterBlocked.stock)).toBe(1);
    expect(created.status).toBe(201);
    expect(Number(afterSale.stock)).toBe(-1);
    expect(forbidden.status).toBe(403);
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.status).toBe(SaleStatus.CANCELLED);
    expect(cancelled.body.cancelReason).toBe('Error en la operación');
    expect(repeated.status).toBe(400);
    expect(Number(restoredProduct.stock)).toBe(1);
    expect(movementTypes).toEqual([
      InventoryMovementType.SALE_OUT,
      InventoryMovementType.VOID_SALE_IN,
    ]);
    expect(auditActions).toEqual(
      expect.arrayContaining([
        'SALE_BLOCKED_INSUFFICIENT_STOCK',
        'SALE_CANCELLED',
        'SALE_STOCK_RESTORED',
      ]),
    );
  });

  it('enforces sales permissions and company isolation', async () => {
    const companyA = await registerCompany('sales-tenant-a');
    const companyB = await registerCompany('sales-tenant-b');
    await Promise.all([
      http<SettingsResponse>(
        'PATCH',
        '/business-settings',
        { requireOpenCashForSales: false },
        companyA.accessToken,
      ),
      http<SettingsResponse>(
        'PATCH',
        '/business-settings',
        { requireOpenCashForSales: false },
        companyB.accessToken,
      ),
    ]);
    const serviceA = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio empresa A', price: 25, taxRate: 0 },
      companyA.accessToken,
    );
    const serviceB = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio empresa B', price: 30, taxRate: 0 },
      companyB.accessToken,
    );
    const roles = await getRoles(companyA.accessToken);
    const [cashier, seller, accounting, warehouse] = await Promise.all([
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.CASHIER).id,
        companyA.branch.id,
        'sales-cashier',
      ),
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.SELLER).id,
        companyA.branch.id,
        'sales-seller',
      ),
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.ACCOUNTING).id,
        companyA.branch.id,
        'sales-accounting',
      ),
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.WAREHOUSE).id,
        companyA.branch.id,
        'sales-warehouse',
      ),
    ]);
    const [cashierSession, sellerSession, accountingSession, warehouseSession] =
      await Promise.all([
        login(cashier.email),
        login(seller.email),
        login(accounting.email),
        login(warehouse.email),
      ]);
    const cashierSale = await http<{ id: string }>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, serviceA.body.id, 1, 25),
      cashierSession.accessToken,
    );
    const sellerSale = await http<{ id: string }>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, serviceA.body.id, 1, 25),
      sellerSession.accessToken,
    );
    const foreignSale = await http<{ id: string }>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, serviceB.body.id, 1, 30),
      companyB.accessToken,
    );
    const accountingList = await http<{ items: Array<{ id: string }> }>(
      'GET',
      '/sales',
      undefined,
      accountingSession.accessToken,
    );
    const accountingDetail = await http<{ id: string }>(
      'GET',
      `/sales/${cashierSale.body.id}`,
      undefined,
      accountingSession.accessToken,
    );
    const accountingCreate = await http<unknown>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, serviceA.body.id, 1, 25),
      accountingSession.accessToken,
    );
    const warehouseList = await http<unknown>(
      'GET',
      '/sales',
      undefined,
      warehouseSession.accessToken,
    );
    const crossRead = await http<unknown>(
      'GET',
      `/sales/${foreignSale.body.id}`,
      undefined,
      companyA.accessToken,
    );

    expect(cashierSale.status).toBe(201);
    expect(sellerSale.status).toBe(201);
    expect(foreignSale.status).toBe(201);
    expect(accountingList.status).toBe(200);
    expect(accountingList.body.items.map(({ id }) => id).sort()).toEqual(
      [cashierSale.body.id, sellerSale.body.id].sort(),
    );
    expect(accountingDetail.status).toBe(200);
    expect(accountingCreate.status).toBe(403);
    expect(warehouseList.status).toBe(403);
    expect(crossRead.status).toBe(404);
  });

  it('opens, moves, reconciles and closes cash with sale and cancellation movements', async () => {
    const registered = await registerCompany('cash-lifecycle');
    const anonymous = await http<unknown>('GET', '/cash/current');
    const negative = await http<unknown>(
      'POST',
      '/cash/open',
      { branchId: registered.branch.id, openingAmount: -1 },
      registered.accessToken,
    );
    const opened = await openCash(
      registered.accessToken,
      registered.branch.id,
      100,
    );
    const duplicate = await http<unknown>(
      'POST',
      '/cash/open',
      { branchId: registered.branch.id, openingAmount: 10 },
      registered.accessToken,
    );
    const current = await http<{
      session: { id: string; status: CashSessionStatus };
    }>('GET', '/cash/current', undefined, registered.accessToken);
    const manualIn = await http<{ expectedCashAmount: string }>(
      'POST',
      '/cash/movements/manual-in',
      {
        cashSessionId: opened.id,
        amount: 50,
        reason: 'Fondo adicional',
      },
      registered.accessToken,
    );
    const manualOut = await http<{ expectedCashAmount: string }>(
      'POST',
      '/cash/movements/manual-out',
      {
        cashSessionId: opened.id,
        amount: 20,
        reason: 'Gasto menor',
      },
      registered.accessToken,
    );
    const service = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio con caja', price: 100, taxRate: 0 },
      registered.accessToken,
    );
    const saleToCancel = await http<{
      id: string;
      cashSessionId: string;
    }>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, service.body.id, 1, 100),
      registered.accessToken,
    );
    const cancelled = await http<{ status: SaleStatus }>(
      'POST',
      `/sales/${saleToCancel.body.id}/cancel`,
      { reason: 'Venta duplicada' },
      registered.accessToken,
    );
    const serviceTwo = await http<Service>(
      'POST',
      '/services',
      { name: 'Segundo servicio con caja', price: 40, taxRate: 0 },
      registered.accessToken,
    );
    const activeSale = await http<{ id: string; cashSessionId: string }>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, serviceTwo.body.id, 1, 40),
      registered.accessToken,
    );
    const detailBeforeClose = await http<{
      expectedCashAmount: string;
      salesCashTotal: string;
      manualInTotal: string;
      manualOutTotal: string;
      movements: Array<{ type: CashMovementType; saleId: string | null }>;
    }>('GET', `/cash/sessions/${opened.id}`, undefined, registered.accessToken);
    const closed = await http<{
      status: CashSessionStatus;
      expectedCashAmount: string;
      countedCashAmount: string;
      differenceAmount: string;
      salesCashTotal: string;
    }>(
      'POST',
      '/cash/close',
      {
        cashSessionId: opened.id,
        countedCashAmount: 165,
        notes: 'Cierre de prueba',
      },
      registered.accessToken,
    );
    const movementAfterClose = await http<unknown>(
      'POST',
      '/cash/movements/manual-in',
      {
        cashSessionId: opened.id,
        amount: 1,
        reason: 'Movimiento tardío',
      },
      registered.accessToken,
    );
    const currentAfterClose = await http<{ session: null }>(
      'GET',
      '/cash/current',
      undefined,
      registered.accessToken,
    );
    const auditActions = (
      await prisma.auditLog.findMany({
        where: { companyId: registered.company.id, module: 'cash' },
        select: { action: true },
      })
    ).map(({ action }) => action);

    expect(anonymous.status).toBe(401);
    expect(negative.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(current.status).toBe(200);
    expect(current.body.session.id).toBe(opened.id);
    expect(current.body.session.status).toBe(CashSessionStatus.OPEN);
    expect(Number(manualIn.body.expectedCashAmount)).toBe(150);
    expect(Number(manualOut.body.expectedCashAmount)).toBe(130);
    expect(saleToCancel.status).toBe(201);
    expect(saleToCancel.body.cashSessionId).toBe(opened.id);
    expect(cancelled.status).toBe(201);
    expect(activeSale.status).toBe(201);
    expect(activeSale.body.cashSessionId).toBe(opened.id);
    expect(Number(detailBeforeClose.body.salesCashTotal)).toBe(140);
    expect(Number(detailBeforeClose.body.manualInTotal)).toBe(50);
    expect(Number(detailBeforeClose.body.manualOutTotal)).toBe(20);
    expect(Number(detailBeforeClose.body.expectedCashAmount)).toBe(170);
    expect(detailBeforeClose.body.movements.map(({ type }) => type)).toEqual(
      expect.arrayContaining([
        CashMovementType.OPENING,
        CashMovementType.MANUAL_IN,
        CashMovementType.MANUAL_OUT,
        CashMovementType.SALE_CASH_IN,
        CashMovementType.SALE_CANCELLED_OUT,
      ]),
    );
    expect(
      detailBeforeClose.body.movements.filter(
        ({ type, saleId }) =>
          type === CashMovementType.SALE_CASH_IN &&
          saleId === activeSale.body.id,
      ),
    ).toHaveLength(1);
    expect(closed.status).toBe(201);
    expect(closed.body.status).toBe(CashSessionStatus.CLOSED);
    expect(Number(closed.body.expectedCashAmount)).toBe(170);
    expect(Number(closed.body.countedCashAmount)).toBe(165);
    expect(Number(closed.body.differenceAmount)).toBe(-5);
    expect(Number(closed.body.salesCashTotal)).toBe(140);
    expect(movementAfterClose.status).toBe(400);
    expect(currentAfterClose.status).toBe(200);
    expect(currentAfterClose.body.session).toBeNull();
    expect(auditActions).toEqual(
      expect.arrayContaining([
        'CASH_SESSION_OPENED',
        'CASH_MANUAL_IN',
        'CASH_MANUAL_OUT',
        'CASH_SALE_PAYMENT_REGISTERED',
        'CASH_SALE_CANCELLED_REVERSED',
        'CASH_SESSION_CLOSED',
      ]),
    );
  });

  it('enforces the open-cash sales setting and allows configured sales without cash', async () => {
    const registered = await registerCompany('cash-required');
    const service = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio caja requerida', price: 25, taxRate: 0 },
      registered.accessToken,
    );
    const blocked = await http<unknown>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, service.body.id, 1, 25),
      registered.accessToken,
    );
    const blockedAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: registered.company.id,
        action: 'CASH_REQUIRED_FOR_SALE_BLOCKED',
      },
    });
    await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { requireOpenCashForSales: false },
      registered.accessToken,
    );
    const allowed = await http<{ id: string; cashSessionId: string | null }>(
      'POST',
      '/sales',
      salePayload(PosItemType.SERVICE, service.body.id, 1, 25),
      registered.accessToken,
    );
    const movements = await prisma.cashMovement.count({
      where: { companyId: registered.company.id },
    });

    expect(blocked.status).toBe(400);
    expect(blockedAudit).not.toBeNull();
    expect(allowed.status).toBe(201);
    expect(allowed.body.cashSessionId).toBeNull();
    expect(movements).toBe(0);
  });

  it('enforces cash permissions and isolates session history by company', async () => {
    const companyA = await registerCompany('cash-tenant-a');
    const companyB = await registerCompany('cash-tenant-b');
    const roles = await getRoles(companyA.accessToken);
    const [cashier, seller, accounting, warehouse] = await Promise.all([
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.CASHIER).id,
        companyA.branch.id,
        'cash-cashier',
      ),
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.SELLER).id,
        companyA.branch.id,
        'cash-seller',
      ),
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.ACCOUNTING).id,
        companyA.branch.id,
        'cash-accounting',
      ),
      createUser(
        companyA.accessToken,
        findRole(roles, UserRole.WAREHOUSE).id,
        companyA.branch.id,
        'cash-warehouse',
      ),
    ]);
    const [cashierSession, sellerSession, accountingSession, warehouseSession] =
      await Promise.all([
        login(cashier.email),
        login(seller.email),
        login(accounting.email),
        login(warehouse.email),
      ]);
    const cashierCash = await openCash(
      cashierSession.accessToken,
      companyA.branch.id,
      20,
    );
    const sellerCurrent = await http<{ session: null }>(
      'GET',
      '/cash/current',
      undefined,
      sellerSession.accessToken,
    );
    const sellerClose = await http<unknown>(
      'POST',
      '/cash/close',
      { cashSessionId: cashierCash.id, countedCashAmount: 20 },
      sellerSession.accessToken,
    );
    const warehouseCurrent = await http<unknown>(
      'GET',
      '/cash/current',
      undefined,
      warehouseSession.accessToken,
    );
    const closedByCashier = await http<{ status: CashSessionStatus }>(
      'POST',
      '/cash/close',
      { cashSessionId: cashierCash.id, countedCashAmount: 20 },
      cashierSession.accessToken,
    );
    const foreignCash = await openCash(
      companyB.accessToken,
      companyB.branch.id,
      30,
    );
    const accountingList = await http<{
      items: Array<{ id: string }>;
      total: number;
    }>('GET', '/cash/sessions', undefined, accountingSession.accessToken);
    const accountingDetail = await http<{ id: string }>(
      'GET',
      `/cash/sessions/${cashierCash.id}`,
      undefined,
      accountingSession.accessToken,
    );
    const crossRead = await http<unknown>(
      'GET',
      `/cash/sessions/${foreignCash.id}`,
      undefined,
      companyA.accessToken,
    );

    expect(cashierCash.status).toBe(CashSessionStatus.OPEN);
    expect(sellerCurrent.status).toBe(200);
    expect(sellerCurrent.body.session).toBeNull();
    expect(sellerClose.status).toBe(403);
    expect(warehouseCurrent.status).toBe(403);
    expect(closedByCashier.status).toBe(201);
    expect(closedByCashier.body.status).toBe(CashSessionStatus.CLOSED);
    expect(accountingList.status).toBe(200);
    expect(accountingList.body.total).toBe(1);
    expect(accountingList.body.items[0]?.id).toBe(cashierCash.id);
    expect(accountingDetail.status).toBe(200);
    expect(accountingDetail.body.id).toBe(cashierCash.id);
    expect(crossRead.status).toBe(404);
  });

  it('creates and manages categories, brands, units, products and services', async () => {
    const registered = await registerCompany('catalog-crud');
    const category = await http<Category>(
      'POST',
      '/categories',
      {
        name: 'Catálogo general',
        type: CategoryType.BOTH,
        description: 'Productos y servicios',
      },
      registered.accessToken,
    );
    const brand = await http<{ id: string; name: string }>(
      'POST',
      '/brands',
      { name: 'Marca local' },
      registered.accessToken,
    );
    const unit = await http<Unit>(
      'POST',
      '/units',
      { name: 'Kilogramo', code: 'KG', allowsDecimals: true },
      registered.accessToken,
    );
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Producto de prueba',
        categoryId: category.body.id,
        brandId: brand.body.id,
        unitId: unit.body.id,
        sku: 'SKU-001',
        barcode: '746000000001',
        cost: 50,
        price: 100,
        taxRate: 18,
        stock: 5,
        minStock: 1,
        trackInventory: true,
        allowDiscount: true,
      },
      registered.accessToken,
    );
    const service = await http<Service>(
      'POST',
      '/services',
      {
        name: 'Servicio de prueba',
        categoryId: category.body.id,
        price: 500,
        taxRate: 18,
        durationMinutes: 45,
      },
      registered.accessToken,
    );
    const products = await http<Product[]>(
      'GET',
      '/products?search=SKU-001',
      undefined,
      registered.accessToken,
    );
    const services = await http<Service[]>(
      'GET',
      '/services?search=Servicio',
      undefined,
      registered.accessToken,
    );
    const updatedProduct = await http<Product>(
      'PATCH',
      `/products/${product.body.id}`,
      { price: 125 },
      registered.accessToken,
    );
    const disabledService = await http<Service>(
      'PATCH',
      `/services/${service.body.id}/status`,
      { status: CatalogStatus.INACTIVE },
      registered.accessToken,
    );

    expect(category.status).toBe(201);
    expect(brand.status).toBe(201);
    expect(unit.status).toBe(201);
    expect(product.status).toBe(201);
    expect(product.body.companyId).toBe(registered.company.id);
    expect(Number(product.body.stock)).toBe(5);
    expect(service.status).toBe(201);
    expect(products.body.map(({ id }) => id)).toEqual([product.body.id]);
    expect(services.body.map(({ id }) => id)).toEqual([service.body.id]);
    expect(Number(updatedProduct.body.price)).toBe(125);
    expect(disabledService.body.status).toBe(CatalogStatus.INACTIVE);
    expect(
      await prisma.auditLog.count({
        where: {
          companyId: registered.company.id,
          action: {
            in: [
              'CATEGORY_CREATED',
              'BRAND_CREATED',
              'UNIT_CREATED',
              'PRODUCT_CREATED',
              'PRODUCT_UPDATED',
              'SERVICE_CREATED',
              'SERVICE_STATUS_CHANGED',
            ],
          },
        },
      }),
    ).toBe(7);
  });

  it('validates catalog data, permissions and multi-company isolation', async () => {
    const companyA = await registerCompany('catalog-a');
    const companyB = await registerCompany('catalog-b');
    const categoryA = await http<Category>(
      'POST',
      '/categories',
      { name: 'Productos A', type: CategoryType.PRODUCT },
      companyA.accessToken,
    );
    const categoryB = await http<Category>(
      'POST',
      '/categories',
      { name: 'Productos B', type: CategoryType.PRODUCT },
      companyB.accessToken,
    );
    const productA = await http<Product>(
      'POST',
      '/products',
      { name: 'Producto A', categoryId: categoryA.body.id, price: 10 },
      companyA.accessToken,
    );
    const productB = await http<Product>(
      'POST',
      '/products',
      { name: 'Producto B', categoryId: categoryB.body.id, price: 20 },
      companyB.accessToken,
    );
    const serviceA = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio A', price: 30 },
      companyA.accessToken,
    );
    const serviceB = await http<Service>(
      'POST',
      '/services',
      { name: 'Servicio B', price: 40 },
      companyB.accessToken,
    );
    const productsA = await http<Product[]>(
      'GET',
      '/products',
      undefined,
      companyA.accessToken,
    );
    const servicesA = await http<Service[]>(
      'GET',
      '/services',
      undefined,
      companyA.accessToken,
    );
    const crossProduct = await http<unknown>(
      'GET',
      `/products/${productB.body.id}`,
      undefined,
      companyA.accessToken,
    );
    const crossServiceUpdate = await http<unknown>(
      'PATCH',
      `/services/${serviceB.body.id}`,
      { price: 99 },
      companyA.accessToken,
    );
    const negativeProduct = await http<unknown>(
      'POST',
      '/products',
      { name: 'Inválido', price: -1 },
      companyA.accessToken,
    );
    const namelessProduct = await http<unknown>(
      'POST',
      '/products',
      { price: 10 },
      companyA.accessToken,
    );
    const negativeService = await http<unknown>(
      'POST',
      '/services',
      { name: 'Inválido', price: -1 },
      companyA.accessToken,
    );
    const roles = await getRoles(companyA.accessToken);
    const cashier = await createUser(
      companyA.accessToken,
      findRole(roles, UserRole.CASHIER).id,
      companyA.branch.id,
      'catalog-cashier',
    );
    const cashierLogin = await login(cashier.email);
    const cashierCreate = await http<unknown>(
      'POST',
      '/products',
      { name: 'No permitido', price: 10 },
      cashierLogin.accessToken,
    );
    const cashierList = await http<Product[]>(
      'GET',
      '/products',
      undefined,
      cashierLogin.accessToken,
    );

    expect(productsA.body.map(({ id }) => id)).toEqual([productA.body.id]);
    expect(servicesA.body.map(({ id }) => id)).toEqual([serviceA.body.id]);
    expect(crossProduct.status).toBe(404);
    expect(crossServiceUpdate.status).toBe(404);
    expect(negativeProduct.status).toBe(400);
    expect(namelessProduct.status).toBe(400);
    expect(negativeService.status).toBe(400);
    expect(cashierCreate.status).toBe(403);
    expect(cashierList.status).toBe(200);
    expect(
      cashierList.body.every(
        ({ companyId }) => companyId === companyA.company.id,
      ),
    ).toBe(true);
  });

  it('registers inventory movements, blocks negative stock by default and exposes low stock', async () => {
    const registered = await registerCompany('inventory-core');
    const product = await http<Product>(
      'POST',
      '/products',
      {
        name: 'Inventario base',
        price: 25,
        stock: 2,
        minStock: 2,
        trackInventory: true,
      },
      registered.accessToken,
    );

    const inventory = await http<{ items: Product[]; total: number }>(
      'GET',
      '/inventory',
      undefined,
      registered.accessToken,
    );
    const manualEntry = await http<{
      product: Product;
      movement: { type: InventoryMovementType };
    }>(
      'POST',
      `/inventory/products/${product.body.id}/manual-entry`,
      { quantity: 3, unitCost: 10, reason: 'Entrada inicial' },
      registered.accessToken,
    );
    const adjustmentIn = await http<{
      product: Product;
      movement: { type: InventoryMovementType };
    }>(
      'POST',
      `/inventory/products/${product.body.id}/adjust`,
      {
        type: InventoryMovementType.ADJUSTMENT_IN,
        quantity: 1,
        reason: 'Sobrante',
      },
      registered.accessToken,
    );
    const blockedAdjustment = await http<unknown>(
      'POST',
      `/inventory/products/${product.body.id}/adjust`,
      {
        type: InventoryMovementType.ADJUSTMENT_OUT,
        quantity: 10,
        reason: 'Intento invalido',
      },
      registered.accessToken,
    );
    const allowNegativeStock = await http<SettingsResponse>(
      'PATCH',
      '/business-settings',
      { allowNegativeStock: true },
      registered.accessToken,
    );
    const adjustmentOut = await http<{
      product: Product;
      movement: { type: InventoryMovementType };
    }>(
      'POST',
      `/inventory/products/${product.body.id}/adjust`,
      {
        type: InventoryMovementType.ADJUSTMENT_OUT,
        quantity: 10,
        reason: 'Rotura masiva',
      },
      registered.accessToken,
    );
    const movements = await http<{
      items: Array<{ type: InventoryMovementType }>;
      total: number;
      product: { id: string; name: string };
    }>(
      'GET',
      `/inventory/products/${product.body.id}/movements`,
      undefined,
      registered.accessToken,
    );
    const lowStock = await http<{ items: Product[]; total: number }>(
      'GET',
      '/inventory/low-stock',
      undefined,
      registered.accessToken,
    );

    expect(inventory.status).toBe(200);
    expect(inventory.body.total).toBe(1);
    expect(inventory.body.items[0]?.id).toBe(product.body.id);
    expect(manualEntry.status).toBe(201);
    expect(Number(manualEntry.body.product.stock)).toBe(5);
    expect(manualEntry.body.movement.type).toBe(
      InventoryMovementType.MANUAL_ENTRY,
    );
    expect(adjustmentIn.status).toBe(201);
    expect(Number(adjustmentIn.body.product.stock)).toBe(6);
    expect(blockedAdjustment.status).toBe(400);
    expect(allowNegativeStock.body.allowNegativeStock).toBe(true);
    expect(adjustmentOut.status).toBe(201);
    expect(Number(adjustmentOut.body.product.stock)).toBe(-4);
    expect(movements.status).toBe(200);
    expect(movements.body.total).toBe(3);
    expect(movements.body.items.map(({ type }) => type)).toEqual([
      InventoryMovementType.ADJUSTMENT_OUT,
      InventoryMovementType.ADJUSTMENT_IN,
      InventoryMovementType.MANUAL_ENTRY,
    ]);
    expect(lowStock.status).toBe(200);
    expect(lowStock.body.items.map(({ id }) => id)).toEqual([product.body.id]);
    expect(
      await prisma.auditLog.count({
        where: {
          companyId: registered.company.id,
          action: {
            in: [
              'INVENTORY_MANUAL_ENTRY',
              'INVENTORY_ADJUSTMENT_IN',
              'INVENTORY_ADJUSTMENT_OUT',
              'INVENTORY_NEGATIVE_STOCK_BLOCKED',
            ],
          },
        },
      }),
    ).toBe(4);
  });

  it('enforces inventory permissions and multi-company isolation', async () => {
    const companyA = await registerCompany('inventory-a');
    const companyB = await registerCompany('inventory-b');
    const productA = await http<Product>(
      'POST',
      '/products',
      { name: 'Producto A', price: 20, stock: 4, minStock: 1 },
      companyA.accessToken,
    );
    const productB = await http<Product>(
      'POST',
      '/products',
      { name: 'Producto B', price: 30, stock: 5, minStock: 1 },
      companyB.accessToken,
    );
    const anonymous = await http<unknown>('GET', '/inventory');
    const roles = await getRoles(companyA.accessToken);
    const warehouse = await createUser(
      companyA.accessToken,
      findRole(roles, UserRole.WAREHOUSE).id,
      companyA.branch.id,
      'inventory-warehouse',
    );
    const cashier = await createUser(
      companyA.accessToken,
      findRole(roles, UserRole.CASHIER).id,
      companyA.branch.id,
      'inventory-cashier',
    );
    const warehouseLogin = await login(warehouse.email);
    const cashierLogin = await login(cashier.email);
    const warehouseAdjustment = await http<{ product: Product }>(
      'POST',
      `/inventory/products/${productA.body.id}/adjust`,
      {
        type: InventoryMovementType.ADJUSTMENT_OUT,
        quantity: 1,
        reason: 'Conteo fisico',
      },
      warehouseLogin.accessToken,
    );
    const cashierAdjustment = await http<unknown>(
      'POST',
      `/inventory/products/${productA.body.id}/adjust`,
      {
        type: InventoryMovementType.ADJUSTMENT_OUT,
        quantity: 1,
        reason: 'No permitido',
      },
      cashierLogin.accessToken,
    );
    const inventoryA = await http<{ items: Product[]; total: number }>(
      'GET',
      '/inventory',
      undefined,
      companyA.accessToken,
    );
    const crossCompanyMovements = await http<unknown>(
      'GET',
      `/inventory/products/${productB.body.id}/movements`,
      undefined,
      companyA.accessToken,
    );
    const crossCompanyManualEntry = await http<unknown>(
      'POST',
      `/inventory/products/${productB.body.id}/manual-entry`,
      { quantity: 1, reason: 'Cruce' },
      companyA.accessToken,
    );

    expect(anonymous.status).toBe(401);
    expect(warehouseAdjustment.status).toBe(201);
    expect(Number(warehouseAdjustment.body.product.stock)).toBe(3);
    expect(cashierAdjustment.status).toBe(403);
    expect(inventoryA.status).toBe(200);
    expect(inventoryA.body.items.map(({ id }) => id)).toEqual([
      productA.body.id,
    ]);
    expect(crossCompanyMovements.status).toBe(404);
    expect(crossCompanyManualEntry.status).toBe(404);
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
    prisma.cashMovement.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.cashSession.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.service.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.businessSettings.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.company.deleteMany(),
  ]);
}

async function openCash(
  accessToken: string,
  branchId: string,
  openingAmount: number,
) {
  const response = await http<{
    id: string;
    status: CashSessionStatus;
    expectedCashAmount: string;
  }>('POST', '/cash/open', { branchId, openingAmount }, accessToken);
  expect(response.status).toBe(201);
  return response.body;
}

function salePayload(
  itemType: PosItemType,
  itemId: string,
  quantity: number,
  total: number,
) {
  return {
    items: [{ itemType, itemId, quantity, discountAmount: 0 }],
    payments: [{ method: PaymentMethod.CASH, amount: total }],
  };
}

function basicCustomerPayload(name: string) {
  return {
    type: CustomerType.INDIVIDUAL,
    name,
    documentType: CustomerDocumentType.NONE,
    taxpayerType: TaxpayerType.FINAL_CONSUMER,
  };
}

function validateProductCart(
  accessToken: string,
  productId: string,
  quantity: number,
) {
  return http<{
    valid: boolean;
    errors: Array<{ code: string }>;
  }>(
    'POST',
    '/pos/validate-cart',
    {
      items: [
        {
          itemType: PosItemType.PRODUCT,
          itemId: productId,
          quantity,
          discountAmount: 0,
        },
      ],
    },
    accessToken,
  );
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
