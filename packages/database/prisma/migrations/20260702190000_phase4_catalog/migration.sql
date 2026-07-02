CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CategoryType" AS ENUM ('PRODUCT', 'SERVICE', 'BOTH');

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "allowsDecimals" BOOLEAN NOT NULL DEFAULT false,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandId" TEXT,
    "unitId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "durationMinutes" INTEGER,
    "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_companyId_name_key" ON "categories"("companyId", "name");
CREATE INDEX "categories_companyId_status_name_idx" ON "categories"("companyId", "status", "name");
CREATE UNIQUE INDEX "brands_companyId_name_key" ON "brands"("companyId", "name");
CREATE INDEX "brands_companyId_status_name_idx" ON "brands"("companyId", "status", "name");
CREATE UNIQUE INDEX "units_companyId_code_key" ON "units"("companyId", "code");
CREATE UNIQUE INDEX "units_companyId_name_key" ON "units"("companyId", "name");
CREATE INDEX "units_companyId_status_name_idx" ON "units"("companyId", "status", "name");
CREATE UNIQUE INDEX "products_companyId_sku_key" ON "products"("companyId", "sku");
CREATE UNIQUE INDEX "products_companyId_barcode_key" ON "products"("companyId", "barcode");
CREATE INDEX "products_companyId_status_name_idx" ON "products"("companyId", "status", "name");
CREATE INDEX "products_companyId_categoryId_idx" ON "products"("companyId", "categoryId");
CREATE INDEX "products_companyId_brandId_idx" ON "products"("companyId", "brandId");
CREATE INDEX "services_companyId_status_name_idx" ON "services"("companyId", "status", "name");
CREATE INDEX "services_companyId_categoryId_idx" ON "services"("companyId", "categoryId");

ALTER TABLE "categories" ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "units" ADD CONSTRAINT "units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt") VALUES
('phase4_categories_view', 'categories.view', 'categories', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_categories_create', 'categories.create', 'categories', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_categories_update', 'categories.update', 'categories', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_categories_disable', 'categories.disable', 'categories', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_brands_view', 'brands.view', 'brands', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_brands_create', 'brands.create', 'brands', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_brands_update', 'brands.update', 'brands', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_brands_disable', 'brands.disable', 'brands', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_units_view', 'units.view', 'units', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_units_create', 'units.create', 'units', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_units_update', 'units.update', 'units', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_units_disable', 'units.disable', 'units', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_products_view', 'products.view', 'products', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_products_create', 'products.create', 'products', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_products_update', 'products.update', 'products', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_products_disable', 'products.disable', 'products', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_services_view', 'services.view', 'services', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_services_create', 'services.create', 'services', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_services_update', 'services.update', 'services', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase4_services_disable', 'services.disable', 'services', 'DISABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase4_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" IN ('categories', 'brands', 'units', 'products', 'services')
WHERE
  r."code" IN ('OWNER', 'ADMIN')
  OR (r."code" IN ('CASHIER', 'SELLER') AND p."action" = 'VIEW')
  OR (
    r."code" = 'WAREHOUSE'
    AND p."module" IN ('categories', 'brands', 'units', 'products')
    AND p."action" IN ('VIEW', 'CREATE', 'UPDATE')
  )
  OR (r."code" = 'ACCOUNTING' AND p."module" IN ('products', 'services') AND p."action" = 'VIEW')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "units" ("id", "companyId", "name", "code", "allowsDecimals", "createdAt", "updatedAt")
SELECT 'unit_' || md5(c."id" || seed."code"), c."id", seed."name", seed."code", seed."allowsDecimals", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
CROSS JOIN (
  VALUES
    ('Unidad', 'UNIT', false),
    ('Libra', 'LB', true),
    ('Metro', 'M', true),
    ('Galón', 'GAL', true),
    ('Caja', 'BOX', false),
    ('Paquete', 'PACK', false)
) AS seed("name", "code", "allowsDecimals")
ON CONFLICT ("companyId", "code") DO NOTHING;
