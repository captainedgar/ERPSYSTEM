import { PrismaClient } from '@prisma/client';

if (process.env.CONFIRM_MIGRATE_PLAN_REQUESTS !== 'true') {
  console.error('Abortado: define CONFIRM_MIGRATE_PLAN_REQUESTS="true".');
  process.exit(1);
}

const prisma = new PrismaClient();
const summary = {
  scanned: 0,
  created: 0,
  skipped: 0,
  unresolved: 0,
  cancelled: 0,
};

function metadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

try {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'SAAS_PLAN_CHANGE_REQUESTED', module: 'company_billing' },
    orderBy: [{ companyId: 'asc' }, { createdAt: 'desc' }],
  });
  summary.scanned = logs.length;
  const activeCompanyIds = new Set();

  for (const log of logs) {
    if (await prisma.planChangeRequest.findUnique({ where: { id: log.id } })) {
      summary.skipped += 1;
      continue;
    }
    const data = metadata(log.metadataJson);
    const subscription = await prisma.companySubscription.findUnique({
      where: { companyId: log.companyId },
      select: { planId: true },
    });
    const requestedPlan = data.requestedPlanId
      ? await prisma.saasPlan.findUnique({
          where: { id: data.requestedPlanId },
        })
      : typeof data.requestedPlanCode === 'string'
        ? await prisma.saasPlan.findFirst({
            where: {
              name: {
                equals: data.requestedPlanName ?? data.requestedPlanCode,
                mode: 'insensitive',
              },
            },
          })
        : null;
    if (!subscription || !requestedPlan || !log.userId) {
      summary.unresolved += 1;
      continue;
    }
    const legacyStatus =
      typeof data.status === 'string' ? data.status : 'PENDING';
    let status = ['APPROVED', 'APPROVED_APPLIED'].includes(legacyStatus)
      ? 'APPROVED_APPLIED'
      : ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(legacyStatus)
        ? legacyStatus
        : 'PENDING';
    if (status === 'PENDING' && activeCompanyIds.has(log.companyId)) {
      status = 'CANCELLED';
      summary.cancelled += 1;
    } else if (status === 'PENDING') {
      activeCompanyIds.add(log.companyId);
    }
    await prisma.planChangeRequest.create({
      data: {
        id: log.id,
        companyId: log.companyId,
        currentPlanId:
          typeof data.currentPlanId === 'string'
            ? data.currentPlanId
            : subscription.planId,
        requestedPlanId: requestedPlan.id,
        requestedByUserId: log.userId,
        status,
        adminNote: typeof data.adminNote === 'string' ? data.adminNote : null,
        reviewedAt:
          typeof data.reviewedAt === 'string'
            ? new Date(data.reviewedAt)
            : null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
        createdAt: log.createdAt,
      },
    });
    summary.created += 1;
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
