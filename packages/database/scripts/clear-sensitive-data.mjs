import { PrismaClient } from '@prisma/client';

const CONFIRM_ENV = 'CONFIRM_CLEAR_DB';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const prisma = new PrismaClient();

const orderedDeletes = [
  ['subscriptionEvents', () => prisma.subscriptionEvent.deleteMany()],
  ['subscriptionPayments', () => prisma.subscriptionPayment.deleteMany()],
  ['companySubscriptions', () => prisma.companySubscription.deleteMany()],
  ['saasPlans', () => prisma.saasPlan.deleteMany()],
  ['platformSessions', () => prisma.platformSession.deleteMany()],
  ['platformAuditLogs', () => prisma.platformAuditLog.deleteMany()],
  ['platformUsers', () => prisma.platformUser.deleteMany()],
  ['fiscalErrors', () => prisma.fiscalError.deleteMany()],
  ['electronicInvoiceEvents', () => prisma.electronicInvoiceEvent.deleteMany()],
  ['electronicInvoices', () => prisma.electronicInvoice.deleteMany()],
  [
    'fiscalProviderCredentials',
    () => prisma.fiscalProviderCredential.deleteMany(),
  ],
  ['fiscalProviders', () => prisma.fiscalProvider.deleteMany()],
  ['fiscalSettings', () => prisma.fiscalSettings.deleteMany()],
  ['cashMovements', () => prisma.cashMovement.deleteMany()],
  ['payments', () => prisma.payment.deleteMany()],
  ['internalDocumentItems', () => prisma.internalDocumentItem.deleteMany()],
  ['internalDocuments', () => prisma.internalDocument.deleteMany()],
  ['saleItems', () => prisma.saleItem.deleteMany()],
  ['sales', () => prisma.sale.deleteMany()],
  ['cashSessions', () => prisma.cashSession.deleteMany()],
  ['documentSequences', () => prisma.documentSequence.deleteMany()],
  ['inventoryMovements', () => prisma.inventoryMovement.deleteMany()],
  ['customers', () => prisma.customer.deleteMany()],
  ['products', () => prisma.product.deleteMany()],
  ['services', () => prisma.service.deleteMany()],
  ['categories', () => prisma.category.deleteMany()],
  ['brands', () => prisma.brand.deleteMany()],
  ['units', () => prisma.unit.deleteMany()],
  ['businessSettings', () => prisma.businessSettings.deleteMany()],
  ['userSessions', () => prisma.userSession.deleteMany()],
  ['auditLogs', () => prisma.auditLog.deleteMany()],
  ['users', () => prisma.user.deleteMany()],
  ['rolePermissions', () => prisma.rolePermission.deleteMany()],
  ['roles', () => prisma.role.deleteMany()],
  ['branches', () => prisma.branch.deleteMany()],
  ['companies', () => prisma.company.deleteMany()],
];

function requireConfirmation() {
  const hasConfirmArg = process.argv.includes('--confirm');
  const hasConfirmEnv = process.env[CONFIRM_ENV] === 'true';
  if (hasConfirmArg || hasConfirmEnv) return;

  console.error(
    [
      'Refusing to clear the database without explicit confirmation.',
      `Use ${CONFIRM_ENV}=true or pass --confirm.`,
      'PowerShell example:',
      `$env:${CONFIRM_ENV}="true"; npm run db:clear-sensitive`,
    ].join('\n'),
  );
  process.exitCode = 1;
  return false;
}

function requireLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exitCode = 1;
    return false;
  }

  const parsed = new URL(databaseUrl);
  const allowNonLocal = process.env.ALLOW_CLEAR_NON_LOCAL_DB === 'true';
  if (LOCAL_HOSTS.has(parsed.hostname) || allowNonLocal) return true;

  console.error(
    [
      `Refusing to clear a non-local database host: ${parsed.hostname}`,
      'This script is intended for local/development databases only.',
      'Set ALLOW_CLEAR_NON_LOCAL_DB=true only after verifying this is not production.',
    ].join('\n'),
  );
  process.exitCode = 1;
  return false;
}

async function main() {
  if (requireConfirmation() === false) return;
  if (!requireLocalDatabase()) return;

  const startedAt = new Date();
  console.log(`Starting sensitive data cleanup at ${startedAt.toISOString()}`);
  console.log('Preserving global permissions and all Prisma migrations.');

  const results = [];
  for (const [label, deleteRows] of orderedDeletes) {
    const result = await deleteRows();
    results.push([label, result.count]);
    console.log(`${label}: deleted ${result.count}`);
  }

  const permissionCount = await prisma.permission.count();
  console.log(`permissions: preserved ${permissionCount}`);
  console.log('Sensitive data cleanup completed.');
  console.table(
    results.map(([table, deleted]) => ({
      table,
      deleted,
    })),
  );
}

main()
  .catch((error) => {
    console.error('Sensitive data cleanup failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
