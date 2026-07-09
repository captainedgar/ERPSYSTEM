import { Currency, PrismaClient, SaasBillingInterval } from '@prisma/client';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const prisma = new PrismaClient();

const plans = [
  {
    name: 'Basico',
    description: 'Operacion comercial esencial para empresas pequenas.',
    price: 1000,
    currency: Currency.DOP,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 5,
    maxUsers: 3,
    maxBranches: 1,
    modules: {
      catalog: true,
      inventory: true,
      pos: true,
      fiscalMock: false,
      reports: false,
    },
  },
  {
    name: 'Pro',
    description: 'Gestion completa con multiples usuarios y sucursales.',
    price: 1500,
    currency: Currency.DOP,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 7,
    maxUsers: 12,
    maxBranches: 3,
    modules: {
      catalog: true,
      inventory: true,
      pos: true,
      fiscalMock: true,
      reports: true,
    },
  },
  {
    name: 'Fiscal',
    description: 'Plan demo para empresas que requieren flujo fiscal mock.',
    price: 2500,
    currency: Currency.DOP,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 10,
    maxUsers: 25,
    maxBranches: 8,
    modules: {
      catalog: true,
      inventory: true,
      pos: true,
      fiscalMock: true,
      fiscalErrors: true,
      reports: true,
    },
  },
];

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
      'Set ALLOW_SEED_NON_LOCAL_DB=true only after verifying this is safe.',
    ].join('\n'),
  );
  process.exitCode = 1;
  return false;
}

async function main() {
  if (!requireLocalDatabase()) return;

  for (const plan of plans) {
    const saved = await prisma.saasPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`SaaS plan ready: ${saved.name}`);
  }
}

main()
  .catch((error) => {
    console.error('SaaS plan seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
