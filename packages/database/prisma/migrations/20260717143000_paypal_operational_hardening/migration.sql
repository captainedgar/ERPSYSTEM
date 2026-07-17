ALTER TABLE "payment_checkout_sessions"
  ADD COLUMN "invoiceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceCurrency" "Currency" NOT NULL DEFAULT 'DOP',
  ADD COLUMN "providerAmount" DECIMAL(12,2),
  ADD COLUMN "providerCurrency" TEXT,
  ADD COLUMN "exchangeRate" DECIMAL(12,6),
  ADD COLUMN "exchangeRateSource" TEXT,
  ADD COLUMN "exchangeRateCapturedAt" TIMESTAMP(3);

UPDATE "payment_checkout_sessions"
SET
  "invoiceAmount" = "amount",
  "invoiceCurrency" = "currency"
WHERE "invoiceAmount" = 0;

ALTER TABLE "subscription_payments"
  ADD COLUMN "providerCaptureId" TEXT;

CREATE UNIQUE INDEX "subscription_payments_providerCaptureId_key"
  ON "subscription_payments"("providerCaptureId");
