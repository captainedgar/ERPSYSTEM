CREATE TYPE "Currency" AS ENUM ('DOP');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CREDIT');
CREATE TYPE "DocumentType" AS ENUM ('INTERNAL_RECEIPT', 'CONSUMER_INVOICE', 'FISCAL_INVOICE');

ALTER TABLE "business_settings"
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "currency" TYPE "Currency" USING ("currency"::"Currency"),
    ALTER COLUMN "currency" SET DEFAULT 'DOP',
    ADD COLUMN "defaultDocumentType" "DocumentType" NOT NULL DEFAULT 'INTERNAL_RECEIPT',
    ADD COLUMN "defaultPaymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    ADD COLUMN "enabledPaymentMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY['CASH'::"PaymentMethod", 'CARD'::"PaymentMethod", 'TRANSFER'::"PaymentMethod"],
    ADD COLUMN "printLogo" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "posQuickSaleMode" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "posShowStock" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "posAllowDiscounts" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "cashRequireOpeningAmount" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "cashAllowExpenses" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
