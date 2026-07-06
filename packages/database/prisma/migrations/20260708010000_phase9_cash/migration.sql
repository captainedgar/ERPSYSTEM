CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashMovementType" AS ENUM (
  'OPENING',
  'SALE_CASH_IN',
  'MANUAL_IN',
  'MANUAL_OUT',
  'SALE_CANCELLED_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT'
);

ALTER TABLE "sales" ADD COLUMN "cashSessionId" TEXT;
ALTER TABLE "payments" ADD COLUMN "cashSessionId" TEXT;

CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingAmount" DECIMAL(12,2) NOT NULL,
    "expectedCashAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedCashAmount" DECIMAL(12,2),
    "differenceAmount" DECIMAL(12,2),
    "salesCashTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "manualInTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "manualOutTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_sessions_amounts_check" CHECK (
      "openingAmount" >= 0
      AND "salesCashTotal" >= 0
      AND "manualInTotal" >= 0
      AND "manualOutTotal" >= 0
      AND ("countedCashAmount" IS NULL OR "countedCashAmount" >= 0)
    ),
    CONSTRAINT "cash_sessions_close_check" CHECK (
      ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedById" IS NULL)
      OR
      ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL
        AND "countedCashAmount" IS NOT NULL AND "differenceAmount" IS NOT NULL)
    )
);

CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "saleId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_movements_amount_check" CHECK (
      "amount" >= 0 AND ("type" = 'OPENING' OR "amount" > 0)
    )
);

CREATE UNIQUE INDEX "cash_sessions_open_user_branch_key"
ON "cash_sessions"("companyId", "branchId", "openedById")
WHERE "status" = 'OPEN';

CREATE INDEX "cash_sessions_companyId_branchId_status_openedAt_idx"
ON "cash_sessions"("companyId", "branchId", "status", "openedAt" DESC);
CREATE INDEX "cash_sessions_companyId_openedById_status_openedAt_idx"
ON "cash_sessions"("companyId", "openedById", "status", "openedAt" DESC);
CREATE INDEX "cash_movements_companyId_cashSessionId_createdAt_idx"
ON "cash_movements"("companyId", "cashSessionId", "createdAt" DESC);
CREATE INDEX "cash_movements_companyId_saleId_idx"
ON "cash_movements"("companyId", "saleId");
CREATE INDEX "cash_movements_companyId_branchId_createdAt_idx"
ON "cash_movements"("companyId", "branchId", "createdAt" DESC);
CREATE INDEX "sales_companyId_cashSessionId_createdAt_idx"
ON "sales"("companyId", "cashSessionId", "createdAt" DESC);
CREATE INDEX "payments_companyId_cashSessionId_createdAt_idx"
ON "payments"("companyId", "cashSessionId", "createdAt" DESC);

ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_sessions_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_sessions_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_sessions_openedById_fkey"
FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_sessions_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_cashSessionId_fkey"
FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_movements"
ADD CONSTRAINT "cash_movements_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales"
ADD CONSTRAINT "sales_cashSessionId_fkey"
FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments"
ADD CONSTRAINT "payments_cashSessionId_fkey"
FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt") VALUES
('phase9_cash_view', 'cash.view', 'cash', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase9_cash_open', 'cash.open', 'cash', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase9_cash_close', 'cash.close', 'cash', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase9_cash_manual', 'cash.manual_movement', 'cash', 'CREATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase9_cash_sessions', 'cash.view_sessions', 'cash', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase9_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'cash'
WHERE
  r."code" IN ('OWNER', 'ADMIN')
  OR (
    r."code" = 'CASHIER'
    AND p."code" IN ('cash.view', 'cash.open', 'cash.close', 'cash.manual_movement', 'cash.view_sessions')
  )
  OR (
    r."code" = 'SELLER'
    AND p."code" = 'cash.view'
  )
  OR (
    r."code" = 'ACCOUNTING'
    AND p."code" IN ('cash.view', 'cash.view_sessions')
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
