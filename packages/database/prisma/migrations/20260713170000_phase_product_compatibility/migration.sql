-- CreateEnum
CREATE TYPE "ProductCompatibilityGroupStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductAlternativeCodeType" AS ENUM ('OEM', 'MANUFACTURER', 'REPLACEMENT', 'OLD_CODE', 'BARCODE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductSubstituteType" AS ENUM ('EQUIVALENT', 'SUBSTITUTE', 'UPGRADE', 'DOWNGRADE', 'RELATED');

-- CreateTable
CREATE TABLE "product_compatibility_groups" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductCompatibilityGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_compatibility_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_compatibility_group_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_compatibility_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_alternative_codes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ProductAlternativeCodeType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_alternative_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_substitutes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "substituteProductId" TEXT NOT NULL,
    "type" "ProductSubstituteType" NOT NULL DEFAULT 'SUBSTITUTE',
    "notes" TEXT,
    "isBidirectional" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_substitutes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_compatibility_groups_companyId_code_key" ON "product_compatibility_groups"("companyId", "code");

-- CreateIndex
CREATE INDEX "product_compatibility_groups_companyId_status_name_idx" ON "product_compatibility_groups"("companyId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_compatibility_group_items_groupId_productId_key" ON "product_compatibility_group_items"("groupId", "productId");

-- CreateIndex
CREATE INDEX "product_compatibility_group_items_companyId_idx" ON "product_compatibility_group_items"("companyId");

-- CreateIndex
CREATE INDEX "product_compatibility_group_items_productId_idx" ON "product_compatibility_group_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_alternative_codes_companyId_code_key" ON "product_alternative_codes"("companyId", "code");

-- CreateIndex
CREATE INDEX "product_alternative_codes_companyId_idx" ON "product_alternative_codes"("companyId");

-- CreateIndex
CREATE INDEX "product_alternative_codes_productId_idx" ON "product_alternative_codes"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_substitutes_companyId_productId_substituteProductId_key" ON "product_substitutes"("companyId", "productId", "substituteProductId");

-- CreateIndex
CREATE INDEX "product_substitutes_companyId_idx" ON "product_substitutes"("companyId");

-- CreateIndex
CREATE INDEX "product_substitutes_productId_idx" ON "product_substitutes"("productId");

-- CreateIndex
CREATE INDEX "product_substitutes_substituteProductId_idx" ON "product_substitutes"("substituteProductId");

-- AddForeignKey
ALTER TABLE "product_compatibility_groups" ADD CONSTRAINT "product_compatibility_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_compatibility_group_items" ADD CONSTRAINT "product_compatibility_group_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_compatibility_group_items" ADD CONSTRAINT "product_compatibility_group_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "product_compatibility_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_compatibility_group_items" ADD CONSTRAINT "product_compatibility_group_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_alternative_codes" ADD CONSTRAINT "product_alternative_codes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_alternative_codes" ADD CONSTRAINT "product_alternative_codes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_substitutes" ADD CONSTRAINT "product_substitutes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_substitutes" ADD CONSTRAINT "product_substitutes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_substitutes" ADD CONSTRAINT "product_substitutes_substituteProductId_fkey" FOREIGN KEY ("substituteProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
