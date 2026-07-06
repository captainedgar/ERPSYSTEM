CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');
CREATE TYPE "CustomerDocumentType" AS ENUM ('CEDULA', 'RNC', 'PASSPORT', 'NONE');
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "TaxpayerType" AS ENUM (
    'FINAL_CONSUMER',
    'FISCAL_CONSUMER',
    'GOVERNMENT',
    'SPECIAL_REGIME',
    'NONE'
);

CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "name" TEXT NOT NULL,
    "commercialName" TEXT,
    "documentType" "CustomerDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "taxpayerType" "TaxpayerType" NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customers_paymentTermsDays_check" CHECK ("paymentTermsDays" >= 0),
    CONSTRAINT "customers_creditLimit_check" CHECK ("creditLimit" >= 0)
);

CREATE UNIQUE INDEX "customers_companyId_documentNumber_key"
ON "customers"("companyId", "documentNumber");

CREATE INDEX "customers_companyId_status_name_idx"
ON "customers"("companyId", "status", "name");

CREATE INDEX "customers_companyId_type_name_idx"
ON "customers"("companyId", "type", "name");

ALTER TABLE "customers"
ADD CONSTRAINT "customers_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt") VALUES
('phase6_customers_view', 'customers.view', 'customers', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase6_customers_create', 'customers.create', 'customers', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase6_customers_update', 'customers.update', 'customers', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase6_customers_change_status', 'customers.change_status', 'customers', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase6_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'customers'
WHERE
  r."code" IN ('OWNER', 'ADMIN')
  OR (
    r."code" IN ('CASHIER', 'SELLER')
    AND p."code" IN ('customers.view', 'customers.create')
  )
  OR (
    r."code" = 'ACCOUNTING'
    AND p."code" IN ('customers.view', 'customers.update')
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
