-- CreateEnum
CREATE TYPE "InternalDocumentType" AS ENUM ('RECEIPT', 'INTERNAL_INVOICE');

-- CreateEnum
CREATE TYPE "InternalDocumentStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateTable
CREATE TABLE "internal_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT,
    "documentNumber" TEXT NOT NULL,
    "documentType" "InternalDocumentType" NOT NULL,
    "status" "InternalDocumentStatus" NOT NULL DEFAULT 'ISSUED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paidTotal" DECIMAL(12,2) NOT NULL,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_document_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "itemType" "SaleItemType" NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_document_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "documentType" "InternalDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_documents_companyId_documentType_documentNumber_key" ON "internal_documents"("companyId", "documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "internal_documents_one_issued_per_sale_type" ON "internal_documents"("companyId", "saleId", "documentType") WHERE "status" = 'ISSUED';

-- CreateIndex
CREATE INDEX "internal_documents_companyId_saleId_documentType_status_idx" ON "internal_documents"("companyId", "saleId", "documentType", "status");

-- CreateIndex
CREATE INDEX "internal_documents_companyId_status_createdAt_idx" ON "internal_documents"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "internal_documents_companyId_customerId_createdAt_idx" ON "internal_documents"("companyId", "customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "internal_documents_companyId_saleId_idx" ON "internal_documents"("companyId", "saleId");

-- CreateIndex
CREATE INDEX "internal_document_items_companyId_documentId_idx" ON "internal_document_items"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "internal_document_items_companyId_productId_idx" ON "internal_document_items"("companyId", "productId");

-- CreateIndex
CREATE INDEX "internal_document_items_companyId_serviceId_idx" ON "internal_document_items"("companyId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_companyId_branchId_documentType_key" ON "document_sequences"("companyId", "branchId", "documentType");

-- CreateIndex
CREATE INDEX "document_sequences_companyId_documentType_idx" ON "document_sequences"("companyId", "documentType");

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_items" ADD CONSTRAINT "internal_document_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_items" ADD CONSTRAINT "internal_document_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "internal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_items" ADD CONSTRAINT "internal_document_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_items" ADD CONSTRAINT "internal_document_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_items" ADD CONSTRAINT "internal_document_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SeedPermissions
INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt")
VALUES
    ('phase10_internal_documents_view', 'internal_documents.view', 'internal_documents', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase10_internal_documents_create', 'internal_documents.create', 'internal_documents', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase10_internal_documents_print', 'internal_documents.print', 'internal_documents', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('phase10_internal_documents_void', 'internal_documents.void', 'internal_documents', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "module" = EXCLUDED."module", "action" = EXCLUDED."action", "updatedAt" = CURRENT_TIMESTAMP;

-- SeedRolePermissions
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase10_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON (
    r."code" IN ('OWNER', 'ADMIN')
    OR (r."code" IN ('CASHIER', 'SELLER') AND p."code" IN ('internal_documents.view', 'internal_documents.create', 'internal_documents.print'))
    OR (r."code" = 'ACCOUNTING' AND p."code" IN ('internal_documents.view', 'internal_documents.print', 'internal_documents.void'))
)
WHERE p."code" IN ('internal_documents.view', 'internal_documents.create', 'internal_documents.print', 'internal_documents.void')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
