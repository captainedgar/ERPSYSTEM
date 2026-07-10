-- Phase 3: internal SaaS subscription invoices.
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'INVOICE_CREATED';
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'INVOICE_PAID';
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'INVOICE_PARTIALLY_PAID';
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'INVOICE_OVERDUE';
ALTER TYPE "SubscriptionEventType" ADD VALUE IF NOT EXISTS 'INVOICE_VOIDED';

CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM (
  'DRAFT',
  'PENDING',
  'PAID',
  'PARTIALLY_PAID',
  'OVERDUE',
  'VOIDED',
  'CANCELLED'
);

CREATE TABLE "subscription_invoice_sequences" (
  "id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscription_invoice_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_invoices" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "companySubscriptionId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "currency" "Currency" NOT NULL DEFAULT 'DOP',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balance" DECIMAL(12,2) NOT NULL,
  "billingPeriodStart" TIMESTAMP(3) NOT NULL,
  "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "notes" TEXT,
  "createdByPlatformUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subscription_payments"
  ADD COLUMN "subscriptionInvoiceId" TEXT;

CREATE UNIQUE INDEX "subscription_invoice_sequences_prefix_key" ON "subscription_invoice_sequences"("prefix");
CREATE UNIQUE INDEX "subscription_invoices_invoiceNumber_key" ON "subscription_invoices"("invoiceNumber");
CREATE INDEX "subscription_invoices_companyId_status_dueDate_idx" ON "subscription_invoices"("companyId", "status", "dueDate");
CREATE INDEX "subscription_invoices_companySubscriptionId_issueDate_idx" ON "subscription_invoices"("companySubscriptionId", "issueDate" DESC);
CREATE INDEX "subscription_invoices_planId_status_idx" ON "subscription_invoices"("planId", "status");
CREATE INDEX "subscription_invoices_status_dueDate_idx" ON "subscription_invoices"("status", "dueDate");
CREATE INDEX "subscription_payments_subscriptionInvoiceId_paidAt_idx" ON "subscription_payments"("subscriptionInvoiceId", "paidAt" DESC);

ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_companySubscriptionId_fkey" FOREIGN KEY ("companySubscriptionId") REFERENCES "company_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_createdByPlatformUserId_fkey" FOREIGN KEY ("createdByPlatformUserId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriptionInvoiceId_fkey" FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
