-- CreateEnum
CREATE TYPE "InventoryTransferStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "product_branch_stocks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_branch_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_branch_stocks_companyId_branchId_productId_key" ON "product_branch_stocks"("companyId", "branchId", "productId");

-- CreateIndex
CREATE INDEX "product_branch_stocks_companyId_idx" ON "product_branch_stocks"("companyId");

-- CreateIndex
CREATE INDEX "product_branch_stocks_branchId_idx" ON "product_branch_stocks"("branchId");

-- CreateIndex
CREATE INDEX "product_branch_stocks_productId_idx" ON "product_branch_stocks"("productId");

-- CreateIndex
CREATE INDEX "inventory_transfers_companyId_createdAt_idx" ON "inventory_transfers"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "inventory_transfers_companyId_fromBranchId_idx" ON "inventory_transfers"("companyId", "fromBranchId");

-- CreateIndex
CREATE INDEX "inventory_transfers_companyId_toBranchId_idx" ON "inventory_transfers"("companyId", "toBranchId");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_companyId_idx" ON "inventory_transfer_items"("companyId");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_transferId_idx" ON "inventory_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_productId_idx" ON "inventory_transfer_items"("productId");

-- AddForeignKey
ALTER TABLE "product_branch_stocks" ADD CONSTRAINT "product_branch_stocks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_stocks" ADD CONSTRAINT "product_branch_stocks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_stocks" ADD CONSTRAINT "product_branch_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing global stock into each company's main branch only.
INSERT INTO "product_branch_stocks" ("id", "companyId", "branchId", "productId", "quantity", "minStock", "createdAt", "updatedAt")
SELECT
    concat('pbs_', md5(p.id || ':' || b.id)),
    p."companyId",
    b.id,
    p.id,
    p.stock,
    p."minStock",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "products" p
JOIN "branches" b ON b."companyId" = p."companyId" AND b."isMain" = true AND b."deletedAt" IS NULL
WHERE p."deletedAt" IS NULL
ON CONFLICT ("companyId", "branchId", "productId") DO NOTHING;
