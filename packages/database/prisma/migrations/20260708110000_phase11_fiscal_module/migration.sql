-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "FiscalProviderMode" AS ENUM ('MOCK', 'PROVIDER');

-- CreateEnum
CREATE TYPE "FiscalProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ElectronicInvoiceStatus" AS ENUM ('DRAFT', 'PENDING_PROVIDER', 'SENT', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ElectronicDocumentType" AS ENUM ('E31', 'E32', 'E33', 'E34', 'E41', 'E43', 'E44', 'E45', 'INTERNAL_TEST');

-- CreateTable
CREATE TABLE "fiscal_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rnc" TEXT,
    "legalName" TEXT,
    "commercialName" TEXT,
    "economicActivity" TEXT,
    "fiscalAddress" TEXT,
    "province" TEXT,
    "municipality" TEXT,
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "providerMode" "FiscalProviderMode" NOT NULL DEFAULT 'MOCK',
    "activeProviderId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_providers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mode" "FiscalProviderMode" NOT NULL DEFAULT 'MOCK',
    "status" "FiscalProviderStatus" NOT NULL DEFAULT 'INACTIVE',
    "baseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_provider_credentials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "saleId" TEXT,
    "internalDocumentId" TEXT,
    "customerId" TEXT,
    "documentType" "ElectronicDocumentType" NOT NULL DEFAULT 'INTERNAL_TEST',
    "status" "ElectronicInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "fiscalNumber" TEXT,
    "providerDocumentId" TEXT,
    "providerTrackId" TEXT,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electronic_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_invoice_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "electronicInvoiceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electronic_invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_errors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "electronicInvoiceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_settings_companyId_key" ON "fiscal_settings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_providers_companyId_code_key" ON "fiscal_providers"("companyId", "code");

-- CreateIndex
CREATE INDEX "fiscal_providers_companyId_status_idx" ON "fiscal_providers"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_provider_credentials_providerId_keyName_key" ON "fiscal_provider_credentials"("providerId", "keyName");

-- CreateIndex
CREATE INDEX "fiscal_provider_credentials_companyId_providerId_idx" ON "fiscal_provider_credentials"("companyId", "providerId");

-- CreateIndex
CREATE INDEX "electronic_invoices_companyId_status_createdAt_idx" ON "electronic_invoices"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "electronic_invoices_companyId_saleId_idx" ON "electronic_invoices"("companyId", "saleId");

-- CreateIndex
CREATE INDEX "electronic_invoices_companyId_internalDocumentId_idx" ON "electronic_invoices"("companyId", "internalDocumentId");

-- CreateIndex
CREATE INDEX "electronic_invoices_companyId_customerId_createdAt_idx" ON "electronic_invoices"("companyId", "customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "electronic_invoice_events_companyId_electronicInvoiceId_createdAt_idx" ON "electronic_invoice_events"("companyId", "electronicInvoiceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "fiscal_errors_companyId_electronicInvoiceId_resolved_idx" ON "fiscal_errors"("companyId", "electronicInvoiceId", "resolved");

-- AddForeignKey
ALTER TABLE "fiscal_settings" ADD CONSTRAINT "fiscal_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_providers" ADD CONSTRAINT "fiscal_providers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_provider_credentials" ADD CONSTRAINT "fiscal_provider_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_provider_credentials" ADD CONSTRAINT "fiscal_provider_credentials_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "fiscal_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_internalDocumentId_fkey" FOREIGN KEY ("internalDocumentId") REFERENCES "internal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoice_events" ADD CONSTRAINT "electronic_invoice_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoice_events" ADD CONSTRAINT "electronic_invoice_events_electronicInvoiceId_fkey" FOREIGN KEY ("electronicInvoiceId") REFERENCES "electronic_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_errors" ADD CONSTRAINT "fiscal_errors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_errors" ADD CONSTRAINT "fiscal_errors_electronicInvoiceId_fkey" FOREIGN KEY ("electronicInvoiceId") REFERENCES "electronic_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedPermissions
INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt")
VALUES
    ('phase11_fiscal_settings_view', 'fiscal.settings.view', 'fiscal', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_settings_update', 'fiscal.settings.update', 'fiscal', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_providers_view', 'fiscal.providers.view', 'fiscal', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_providers_configure', 'fiscal.providers.configure', 'fiscal', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_documents_view', 'fiscal.documents.view', 'fiscal', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_documents_create', 'fiscal.documents.create', 'fiscal', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_documents_send', 'fiscal.documents.send', 'fiscal', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_documents_retry', 'fiscal.documents.retry', 'fiscal', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_documents_view_events', 'fiscal.documents.view_events', 'fiscal', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase11_fiscal_documents_view_errors', 'fiscal.documents.view_errors', 'fiscal', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "module" = EXCLUDED."module", "action" = EXCLUDED."action", "updatedAt" = CURRENT_TIMESTAMP;

-- SeedRolePermissions
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase11_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON (
    r."code" IN ('OWNER', 'ADMIN')
    OR (
      r."code" = 'ACCOUNTING'
      AND p."code" IN (
        'fiscal.settings.view',
        'fiscal.settings.update',
        'fiscal.providers.view',
        'fiscal.providers.configure',
        'fiscal.documents.view',
        'fiscal.documents.create',
        'fiscal.documents.send',
        'fiscal.documents.retry',
        'fiscal.documents.view_events',
        'fiscal.documents.view_errors'
      )
    )
    OR (
      r."code" = 'CASHIER'
      AND p."code" IN ('fiscal.documents.view')
    )
)
WHERE p."code" IN (
  'fiscal.settings.view',
  'fiscal.settings.update',
  'fiscal.providers.view',
  'fiscal.providers.configure',
  'fiscal.documents.view',
  'fiscal.documents.create',
  'fiscal.documents.send',
  'fiscal.documents.retry',
  'fiscal.documents.view_events',
  'fiscal.documents.view_errors'
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
