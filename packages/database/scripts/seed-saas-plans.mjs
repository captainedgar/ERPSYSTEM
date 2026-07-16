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
      code: 'BASIC',
      maxProducts: 500,
      pos: true,
      sales: true,
      cash: true,
      customers: true,
      inventory_basic: true,
      reports_basic: true,
      fiscalMock: false,
    },
  },
  {
    name: 'Pro',
    description: 'Gestion completa con multiples usuarios y sucursales.',
    price: 2500,
    currency: Currency.DOP,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 7,
    maxUsers: 10,
    maxBranches: 3,
    modules: {
      code: 'PRO',
      maxProducts: 5000,
      pos: true,
      sales: true,
      cash: true,
      customers: true,
      inventory_basic: true,
      reports_basic: true,
      multi_branch: true,
      inventory_transfers: true,
      product_import: true,
      data_export_basic: true,
      financial_dashboard: true,
      advanced_reports: true,
    },
  },
  {
    name: 'Premium',
    description: 'Operacion avanzada para empresas multi-sucursal.',
    price: 5000,
    currency: Currency.DOP,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 10,
    maxUsers: 30,
    maxBranches: 10,
    modules: {
      code: 'PREMIUM',
      maxProducts: 20000,
      pos: true,
      sales: true,
      cash: true,
      customers: true,
      inventory_basic: true,
      reports_basic: true,
      multi_branch: true,
      inventory_transfers: true,
      product_import: true,
      product_compatibility: true,
      fiscal_mock: true,
      data_export_basic: true,
      data_export_full: true,
      backup_xlsx: true,
      financial_dashboard: true,
      advanced_reports: true,
      priority_support: true,
    },
  },
  {
    name: 'Enterprise',
    description: 'Limites y configuracion comercial personalizada.',
    price: 0,
    currency: Currency.DOP,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 10,
    maxUsers: null,
    maxBranches: null,
    modules: {
      code: 'ENTERPRISE',
      maxProducts: null,
      customLimits: true,
      pos: true,
      sales: true,
      cash: true,
      customers: true,
      inventory_basic: true,
      reports_basic: true,
      multi_branch: true,
      inventory_transfers: true,
      product_import: true,
      product_compatibility: true,
      fiscal_mock: true,
      data_export_basic: true,
      data_export_full: true,
      backup_xlsx: true,
      financial_dashboard: true,
      advanced_reports: true,
      priority_support: true,
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
