CREATE TYPE "InventoryMovementType" AS ENUM (
    'MANUAL_ENTRY',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'RETURN_IN',
    'VOID_SALE_IN',
    'SALE_OUT',
    'PURCHASE_IN'
);

CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "previousStock" DECIMAL(14,3) NOT NULL,
    "newStock" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_movements_companyId_createdAt_idx"
ON "inventory_movements"("companyId", "createdAt" DESC);

CREATE INDEX "inventory_movements_companyId_branchId_createdAt_idx"
ON "inventory_movements"("companyId", "branchId", "createdAt" DESC);

CREATE INDEX "inventory_movements_companyId_productId_createdAt_idx"
ON "inventory_movements"("companyId", "productId", "createdAt" DESC);

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movements_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt") VALUES
('phase5_inventory_view', 'inventory.view', 'inventory', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase5_inventory_adjust', 'inventory.adjust', 'inventory', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase5_inventory_view_movements', 'inventory.view_movements', 'inventory', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase5_inventory_view_low_stock', 'inventory.view_low_stock', 'inventory', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase5_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'inventory'
WHERE
  r."code" IN ('OWNER', 'ADMIN')
  OR (r."code" IN ('CASHIER', 'SELLER') AND p."code" IN ('inventory.view', 'inventory.view_low_stock'))
  OR (
    r."code" = 'WAREHOUSE'
    AND p."code" IN (
      'inventory.view',
      'inventory.adjust',
      'inventory.view_movements',
      'inventory.view_low_stock'
    )
  )
  OR (
    r."code" = 'ACCOUNTING'
    AND p."code" IN (
      'inventory.view',
      'inventory.view_movements',
      'inventory.view_low_stock'
    )
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
