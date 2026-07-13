-- CreateEnum
CREATE TYPE "SubscriptionPaymentLinkStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAID');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentReportStatus" AS ENUM ('REPORTED', 'REVIEWED', 'DISCARDED');

-- CreateTable
CREATE TABLE "subscription_payment_links" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionInvoiceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "SubscriptionPaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'DOP',
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdByPlatformUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payment_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionInvoiceId" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "status" "SubscriptionPaymentReportStatus" NOT NULL DEFAULT 'REPORTED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'DOP',
    "payerName" TEXT,
    "payerEmail" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payment_links_token_key" ON "subscription_payment_links"("token");

-- CreateIndex
CREATE INDEX "subscription_payment_links_companyId_status_createdAt_idx" ON "subscription_payment_links"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "subscription_payment_links_subscriptionInvoiceId_status_createdAt_idx" ON "subscription_payment_links"("subscriptionInvoiceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "subscription_payment_links_status_expiresAt_idx" ON "subscription_payment_links"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "subscription_payment_reports_companyId_reportedAt_idx" ON "subscription_payment_reports"("companyId", "reportedAt" DESC);

-- CreateIndex
CREATE INDEX "subscription_payment_reports_subscriptionInvoiceId_reportedAt_idx" ON "subscription_payment_reports"("subscriptionInvoiceId", "reportedAt" DESC);

-- CreateIndex
CREATE INDEX "subscription_payment_reports_paymentLinkId_reportedAt_idx" ON "subscription_payment_reports"("paymentLinkId", "reportedAt" DESC);

-- AddForeignKey
ALTER TABLE "subscription_payment_links" ADD CONSTRAINT "subscription_payment_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment_links" ADD CONSTRAINT "subscription_payment_links_subscriptionInvoiceId_fkey" FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "subscription_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment_links" ADD CONSTRAINT "subscription_payment_links_createdByPlatformUserId_fkey" FOREIGN KEY ("createdByPlatformUserId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment_reports" ADD CONSTRAINT "subscription_payment_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment_reports" ADD CONSTRAINT "subscription_payment_reports_subscriptionInvoiceId_fkey" FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "subscription_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment_reports" ADD CONSTRAINT "subscription_payment_reports_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "subscription_payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
