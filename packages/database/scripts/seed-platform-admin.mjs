import { PrismaClient, PlatformRole, PlatformUserStatus } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function requireLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exitCode = 1;
    return false;
  }
  const parsed = new URL(databaseUrl);
  const allowNonLocal = process.env.ALLOW_SEED_NON_LOCAL_DB === 'true';
  if (LOCAL_HOSTS.has(parsed.hostname) || allowNonLocal) return true;

  console.error(
    [
      `Refusing to seed a non-local database host: ${parsed.hostname}`,
      'This seed is intended for local/development databases only.',
    ].join('\n'),
  );
  process.exitCode = 1;
  return false;
}

async function main() {
  if (!requireLocalDatabase()) return;

  const email = (
    process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@platform.local'
  ).toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? 'Admin12345!';
  const name = process.env.PLATFORM_ADMIN_NAME ?? 'Platform Admin Local';
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? '12');
  if (
    process.env.ALLOW_SEED_NON_LOCAL_DB === 'true' &&
    (!process.env.PLATFORM_ADMIN_PASSWORD || password === 'Admin12345!')
  ) {
    throw new Error(
      'PLATFORM_ADMIN_PASSWORD fuerte y explicita es obligatoria fuera de local.',
    );
  }

  const user = await prisma.platformUser.upsert({
    where: { email },
    update: {
      name,
      passwordHash: await hash(password, rounds),
      role: PlatformRole.SUPER_ADMIN,
      status: PlatformUserStatus.ACTIVE,
    },
    create: {
      email,
      name,
      passwordHash: await hash(password, rounds),
      role: PlatformRole.SUPER_ADMIN,
      status: PlatformUserStatus.ACTIVE,
    },
    select: { id: true, email: true, role: true, status: true },
  });

  console.log('Platform admin user ready.');
  console.table([{ email: user.email, role: user.role, status: user.status }]);
  console.log('Password configured through PLATFORM_ADMIN_PASSWORD.');
}

main()
  .catch((error) => {
    console.error('Platform admin seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
