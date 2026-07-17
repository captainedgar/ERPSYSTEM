CREATE TYPE "PlanChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED_PENDING_PAYMENT', 'APPROVED_APPLIED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED');
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL_CHECKOUT');
CREATE TYPE "PaymentCheckoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'FAILED');
ALTER TYPE "SubscriptionPaymentMethod" ADD VALUE 'PAYPAL';
ALTER TABLE "subscription_payments" ALTER COLUMN "createdByPlatformUserId" DROP NOT NULL;

CREATE TABLE "plan_change_requests" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "currentPlanId" TEXT NOT NULL,
  "requestedPlanId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "PlanChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "adminNote" TEXT,
  "reviewedByPlatformUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "checkoutSessionId" TEXT,
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plan_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_checkout_sessions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "planChangeRequestId" TEXT,
  "provider" "PaymentProvider" NOT NULL,
  "providerSessionId" TEXT,
  "providerOrderId" TEXT,
  "status" "PaymentCheckoutStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'DOP',
  "checkoutUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_change_requests_checkoutSessionId_key" ON "plan_change_requests"("checkoutSessionId");
CREATE UNIQUE INDEX "plan_change_requests_one_active_per_company" ON "plan_change_requests"("companyId") WHERE "status" IN ('PENDING', 'APPROVED_PENDING_PAYMENT', 'PAYMENT_FAILED');
CREATE INDEX "plan_change_requests_companyId_status_createdAt_idx" ON "plan_change_requests"("companyId", "status", "createdAt" DESC);
CREATE INDEX "plan_change_requests_requestedByUserId_createdAt_idx" ON "plan_change_requests"("requestedByUserId", "createdAt" DESC);
CREATE UNIQUE INDEX "payment_checkout_sessions_providerSessionId_key" ON "payment_checkout_sessions"("providerSessionId");
CREATE UNIQUE INDEX "payment_checkout_sessions_providerOrderId_key" ON "payment_checkout_sessions"("providerOrderId");
CREATE INDEX "payment_checkout_sessions_companyId_status_createdAt_idx" ON "payment_checkout_sessions"("companyId", "status", "createdAt" DESC);
CREATE INDEX "payment_checkout_sessions_invoiceId_status_idx" ON "payment_checkout_sessions"("invoiceId", "status");
CREATE UNIQUE INDEX "payment_webhook_events_provider_eventId_key" ON "payment_webhook_events"("provider", "eventId");
CREATE INDEX "payment_webhook_events_status_createdAt_idx" ON "payment_webhook_events"("status", "createdAt");

ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_currentPlanId_fkey" FOREIGN KEY ("currentPlanId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_requestedPlanId_fkey" FOREIGN KEY ("requestedPlanId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_reviewedByPlatformUserId_fkey" FOREIGN KEY ("reviewedByPlatformUserId") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_checkout_sessions" ADD CONSTRAINT "payment_checkout_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_checkout_sessions" ADD CONSTRAINT "payment_checkout_sessions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "subscription_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_checkout_sessions" ADD CONSTRAINT "payment_checkout_sessions_planChangeRequestId_fkey" FOREIGN KEY ("planChangeRequestId") REFERENCES "plan_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "payment_checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
