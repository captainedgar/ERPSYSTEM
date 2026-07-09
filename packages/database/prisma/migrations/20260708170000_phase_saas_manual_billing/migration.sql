CREATE TYPE "SaasBillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "CompanySubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD_MANUAL', 'CHECK', 'OTHER');
CREATE TYPE "SubscriptionEventType" AS ENUM ('PLAN_ASSIGNED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'PAYMENT_REGISTERED', 'NEXT_PAYMENT_DATE_UPDATED');

CREATE TABLE "saas_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'DOP',
    "billingInterval" "SaasBillingInterval" NOT NULL,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "maxUsers" INTEGER,
    "maxBranches" INTEGER,
    "modules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "CompanySubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "nextPaymentDueAt" TIMESTAMP(3) NOT NULL,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "graceEndsAt" TIMESTAMP(3),
    "scheduledSuspensionAt" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "companySubscriptionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'DOP',
    "method" "SubscriptionPaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdByPlatformUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "companySubscriptionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdByPlatformUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saas_plans_name_key" ON "saas_plans"("name");
CREATE INDEX "saas_plans_isActive_billingInterval_idx" ON "saas_plans"("isActive", "billingInterval");
CREATE UNIQUE INDEX "company_subscriptions_companyId_key" ON "company_subscriptions"("companyId");
CREATE INDEX "company_subscriptions_planId_status_idx" ON "company_subscriptions"("planId", "status");
CREATE INDEX "company_subscriptions_status_nextPaymentDueAt_idx" ON "company_subscriptions"("status", "nextPaymentDueAt");
CREATE INDEX "subscription_payments_companyId_paidAt_idx" ON "subscription_payments"("companyId", "paidAt" DESC);
CREATE INDEX "subscription_payments_companySubscriptionId_paidAt_idx" ON "subscription_payments"("companySubscriptionId", "paidAt" DESC);
CREATE INDEX "subscription_payments_createdByPlatformUserId_createdAt_idx" ON "subscription_payments"("createdByPlatformUserId", "createdAt");
CREATE INDEX "subscription_events_companyId_createdAt_idx" ON "subscription_events"("companyId", "createdAt" DESC);
CREATE INDEX "subscription_events_companySubscriptionId_createdAt_idx" ON "subscription_events"("companySubscriptionId", "createdAt" DESC);

ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_companySubscriptionId_fkey" FOREIGN KEY ("companySubscriptionId") REFERENCES "company_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_createdByPlatformUserId_fkey" FOREIGN KEY ("createdByPlatformUserId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_companySubscriptionId_fkey" FOREIGN KEY ("companySubscriptionId") REFERENCES "company_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_createdByPlatformUserId_fkey" FOREIGN KEY ("createdByPlatformUserId") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
