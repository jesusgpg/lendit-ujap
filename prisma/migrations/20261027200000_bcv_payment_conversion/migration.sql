ALTER TABLE "Payment"
  ADD COLUMN "transferAmountVES" DECIMAL(18, 2),
  ADD COLUMN "exchangeRate" DECIMAL(18, 8),
  ADD COLUMN "exchangeRateDate" VARCHAR(10),
  ADD COLUMN "exchangeRateSource" VARCHAR(40);
