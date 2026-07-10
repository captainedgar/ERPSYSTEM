import {
  CompanyStatus,
  CompanySubscriptionStatus,
  PrismaClient,
  SubscriptionEventType,
  SubscriptionInvoiceStatus,
} from '@prisma/client';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const prisma = new PrismaClient();

function requireLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exitCode = 1;
    return false;
  }

  const parsed = new URL(databaseUrl);
  const allowNonLocal =
    process.env.ALLOW_BILLING_PROCESS_NON_LOCAL_DB === 'true';
  if (LOCAL_HOSTS.has(parsed.hostname) || allowNonLocal) return true;

  console.error(
    [
      `Refusing to process billing on a non-local database host: ${parsed.hostname}`,
      'Set ALLOW_BILLING_PROCESS_NON_LOCAL_DB=true only after verifying this is safe.',
    ].join('\n'),
  );
  process.exitCode = 1;
  return false;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function processOverdueSubscriptions(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const total = await tx.companySubscription.count({
      where: {
        status: {
          in: [
            CompanySubscriptionStatus.ACTIVE,
            CompanySubscriptionStatus.GRACE_PERIOD,
          ],
        },
      },
    });
    const activeOverdue = await tx.companySubscription.findMany({
      where: {
        status: CompanySubscriptionStatus.ACTIVE,
        nextPaymentDueAt: { lte: now },
      },
      orderBy: { nextPaymentDueAt: 'asc' },
    });
    const graceExpired = await tx.companySubscription.findMany({
      where: {
        status: CompanySubscriptionStatus.GRACE_PERIOD,
        graceEndsAt: { lt: now },
      },
      orderBy: { graceEndsAt: 'asc' },
    });
    const overdueInvoices = await tx.subscriptionInvoice.findMany({
      where: {
        status: {
          in: [
            SubscriptionInvoiceStatus.PENDING,
            SubscriptionInvoiceStatus.PARTIALLY_PAID,
          ],
        },
        dueDate: { lt: now },
      },
    });

    for (const subscription of activeOverdue) {
      const graceEndsAt = addDays(
        subscription.nextPaymentDueAt,
        subscription.graceDays,
      );
      await tx.companySubscription.update({
        where: { id: subscription.id },
        data: {
          status: CompanySubscriptionStatus.GRACE_PERIOD,
          graceEndsAt,
          scheduledSuspensionAt: graceEndsAt,
        },
      });
      await tx.subscriptionEvent.createMany({
        data: [
          {
            companySubscriptionId: subscription.id,
            companyId: subscription.companyId,
            type: SubscriptionEventType.SUBSCRIPTION_GRACE_STARTED,
            message: 'Suscripcion entro automaticamente en periodo de gracia',
            metadata: {
              nextPaymentDueAt: subscription.nextPaymentDueAt.toISOString(),
              graceEndsAt: graceEndsAt.toISOString(),
              processedAt: now.toISOString(),
            },
          },
          {
            companySubscriptionId: subscription.id,
            companyId: subscription.companyId,
            type: SubscriptionEventType.BILLING_OVERDUE_PROCESS_RUN,
            message: 'Proceso de vencimientos aplico periodo de gracia',
            metadata: { processedAt: now.toISOString() },
          },
        ],
      });
      await tx.platformAuditLog.create({
        data: {
          action: 'SUBSCRIPTION_GRACE_STARTED',
          module: 'platform_billing',
          entityType: 'CompanySubscription',
          entityId: subscription.id,
          description: 'Suscripcion entro automaticamente en periodo de gracia',
          metadataJson: {
            companyId: subscription.companyId,
            nextPaymentDueAt: subscription.nextPaymentDueAt.toISOString(),
            graceEndsAt: graceEndsAt.toISOString(),
          },
        },
      });
    }

    for (const subscription of graceExpired) {
      await tx.companySubscription.update({
        where: { id: subscription.id },
        data: {
          status: CompanySubscriptionStatus.SUSPENDED,
          suspendedAt: now,
        },
      });
      await tx.company.update({
        where: { id: subscription.companyId },
        data: { status: CompanyStatus.SUSPENDED },
      });
      await tx.subscriptionEvent.createMany({
        data: [
          {
            companySubscriptionId: subscription.id,
            companyId: subscription.companyId,
            type: SubscriptionEventType.COMPANY_AUTO_SUSPENDED_FOR_NON_PAYMENT,
            message: 'Empresa suspendida automaticamente por falta de pago',
            metadata: {
              graceEndsAt: subscription.graceEndsAt?.toISOString(),
              suspendedAt: now.toISOString(),
            },
          },
          {
            companySubscriptionId: subscription.id,
            companyId: subscription.companyId,
            type: SubscriptionEventType.BILLING_OVERDUE_PROCESS_RUN,
            message: 'Proceso de vencimientos aplico suspension automatica',
            metadata: { processedAt: now.toISOString() },
          },
        ],
      });
      await tx.platformAuditLog.create({
        data: {
          action: 'COMPANY_AUTO_SUSPENDED_FOR_NON_PAYMENT',
          module: 'platform_billing',
          entityType: 'Company',
          entityId: subscription.companyId,
          description: 'Empresa suspendida automaticamente por falta de pago',
          metadataJson: {
            subscriptionId: subscription.id,
            graceEndsAt: subscription.graceEndsAt?.toISOString(),
            suspendedAt: now.toISOString(),
          },
        },
      });
    }

    if (overdueInvoices.length) {
      await tx.subscriptionInvoice.updateMany({
        where: { id: { in: overdueInvoices.map((invoice) => invoice.id) } },
        data: { status: SubscriptionInvoiceStatus.OVERDUE },
      });
      await tx.subscriptionEvent.createMany({
        data: overdueInvoices.map((invoice) => ({
          companySubscriptionId: invoice.companySubscriptionId,
          companyId: invoice.companyId,
          type: SubscriptionEventType.INVOICE_OVERDUE,
          message: `Factura interna ${invoice.invoiceNumber} marcada como vencida`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            processedAt: now.toISOString(),
          },
        })),
      });
      await tx.platformAuditLog.createMany({
        data: overdueInvoices.map((invoice) => ({
          action: 'SUBSCRIPTION_INVOICE_OVERDUE',
          module: 'platform_billing',
          entityType: 'SubscriptionInvoice',
          entityId: invoice.id,
          description: `Factura interna ${invoice.invoiceNumber} marcada como vencida`,
          metadataJson: {
            invoiceNumber: invoice.invoiceNumber,
            processedAt: now.toISOString(),
          },
        })),
      });
    }

    const movedToGracePeriod = activeOverdue.length;
    const companiesSuspended = graceExpired.length;
    const noActionRequired = total - movedToGracePeriod - companiesSuspended;

    await tx.platformAuditLog.create({
      data: {
        action: 'BILLING_OVERDUE_PROCESS_RUN',
        module: 'platform_billing',
        description: 'Proceso de vencimientos de billing ejecutado',
        metadataJson: {
          movedToGracePeriod,
          companiesSuspended,
          invoicesOverdue: overdueInvoices.length,
          noActionRequired,
        },
      },
    });

    return {
      movedToGracePeriod,
      companiesSuspended,
      invoicesOverdue: overdueInvoices.length,
      noActionRequired,
    };
  });
}

async function main() {
  if (!requireLocalDatabase()) return;

  console.log('Billing overdue process started');
  const result = await processOverdueSubscriptions();
  console.log(
    `Subscriptions moved to grace period: ${result.movedToGracePeriod}`,
  );
  console.log(`Companies suspended: ${result.companiesSuspended}`);
  console.log(`Invoices marked overdue: ${result.invoicesOverdue}`);
  console.log(`No action required: ${result.noActionRequired}`);
  console.log('Billing overdue process completed');
}

main()
  .catch((error) => {
    console.error('Billing overdue process failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
