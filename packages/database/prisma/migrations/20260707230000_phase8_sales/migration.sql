CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SaleItemType" AS ENUM ('PRODUCT', 'SERVICE');

CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "saleNumber" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paidTotal" DECIMAL(12,2) NOT NULL,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_amounts_check" CHECK (
      "subtotal" >= 0 AND "taxTotal" >= 0 AND "discountTotal" >= 0
      AND "total" >= 0 AND "paidTotal" >= 0 AND "balanceDue" >= 0
    )
);

CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
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
    "affectsInventory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sale_items_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "sale_items_amounts_check" CHECK (
      "unitPrice" >= 0 AND "taxRate" >= 0 AND "discountAmount" >= 0
      AND "subtotal" >= 0 AND "taxTotal" >= 0 AND "total" >= 0
    ),
    CONSTRAINT "sale_items_source_check" CHECK (
      ("itemType" = 'PRODUCT' AND "productId" IS NOT NULL AND "serviceId" IS NULL)
      OR
      ("itemType" = 'SERVICE' AND "serviceId" IS NOT NULL AND "productId" IS NULL)
    )
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "sales_companyId_saleNumber_key" ON "sales"("companyId", "saleNumber");
CREATE INDEX "sales_companyId_status_createdAt_idx" ON "sales"("companyId", "status", "createdAt" DESC);
CREATE INDEX "sales_companyId_customerId_createdAt_idx" ON "sales"("companyId", "customerId", "createdAt" DESC);
CREATE INDEX "sales_companyId_branchId_createdAt_idx" ON "sales"("companyId", "branchId", "createdAt" DESC);
CREATE INDEX "sale_items_companyId_saleId_idx" ON "sale_items"("companyId", "saleId");
CREATE INDEX "sale_items_companyId_productId_idx" ON "sale_items"("companyId", "productId");
CREATE INDEX "sale_items_companyId_serviceId_idx" ON "sale_items"("companyId", "serviceId");
CREATE INDEX "payments_companyId_saleId_idx" ON "payments"("companyId", "saleId");
CREATE INDEX "payments_companyId_method_createdAt_idx" ON "payments"("companyId", "method", "createdAt" DESC);

ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt") VALUES
('phase8_sales_view', 'sales.view', 'sales', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase8_sales_create', 'sales.create', 'sales', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase8_sales_cancel', 'sales.cancel', 'sales', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase8_sales_view_detail', 'sales.view_detail', 'sales', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase8_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'sales'
WHERE
  r."code" IN ('OWNER', 'ADMIN')
  OR (
    r."code" IN ('CASHIER', 'SELLER')
    AND p."code" IN ('sales.view', 'sales.create', 'sales.view_detail')
  )
  OR (
    r."code" = 'ACCOUNTING'
    AND p."code" IN ('sales.view', 'sales.view_detail')
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
