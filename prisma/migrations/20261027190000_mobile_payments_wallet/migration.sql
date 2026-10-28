CREATE TYPE "PaymentPurpose" AS ENUM ('RENTAL', 'WALLET_TOP_UP');
CREATE TYPE "WalletTransactionType" AS ENUM ('RENTAL_CREDIT', 'RENTAL_DEBIT', 'WALLET_TOP_UP', 'RENTAL_REFUND', 'RENTAL_REVERSAL');

ALTER TABLE "Payment"
  ADD COLUMN "idempotencyKey" UUID,
  ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'RENTAL',
  ADD COLUMN "proofPath" VARCHAR(255),
  ADD COLUMN "payerBank" VARCHAR(100),
  ADD COLUMN "payerPhone" VARCHAR(30),
  ADD COLUMN "payerNationalId" VARCHAR(20);

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_purpose_status_createdAt_idx" ON "Payment"("purpose", "status", "createdAt");

CREATE TABLE "MobilePaymentProfile" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "bank" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(30) NOT NULL,
  "nationalId" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobilePaymentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobilePaymentProfile_userId_key" ON "MobilePaymentProfile"("userId");
ALTER TABLE "MobilePaymentProfile"
  ADD CONSTRAINT "MobilePaymentProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WalletAccount" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "currency" "Currency" NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletAccount_userId_currency_key" ON "WalletAccount"("userId", "currency");
CREATE INDEX "WalletAccount_userId_updatedAt_idx" ON "WalletAccount"("userId", "updatedAt");
ALTER TABLE "WalletAccount"
  ADD CONSTRAINT "WalletAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.lendit_create_wallet_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Role" WHERE "id" = NEW."roleId" AND "name" <> 'ADMIN') THEN
    INSERT INTO public."WalletAccount" ("id", "userId", "currency", "balance", "createdAt", "updatedAt")
    SELECT gen_random_uuid(), NEW."id", currency_value, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM unnest(enum_range(NULL::public."Currency")) AS currencies(currency_value)
    ON CONFLICT ("userId", "currency") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "User_create_wallet_accounts"
AFTER INSERT ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.lendit_create_wallet_accounts();

INSERT INTO public."WalletAccount" ("id", "userId", "currency", "balance", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id", currency_value, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM public."User" u
JOIN public."Role" r ON r."id" = u."roleId" AND r."name" <> 'ADMIN'
CROSS JOIN unnest(enum_range(NULL::public."Currency")) AS currencies(currency_value)
ON CONFLICT ("userId", "currency") DO NOTHING;

CREATE TABLE "WalletTransaction" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "type" "WalletTransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "description" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTransaction_paymentId_userId_type_key"
  ON "WalletTransaction"("paymentId", "userId", "type");
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");
CREATE INDEX "WalletTransaction_accountId_createdAt_idx" ON "WalletTransaction"("accountId", "createdAt");
ALTER TABLE "WalletTransaction"
  ADD CONSTRAINT "WalletTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WalletTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WalletTransaction_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."MobilePaymentProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WalletAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WalletTransaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lendit_payment_owner_read"
ON public."Payment" FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public."User" u
  WHERE u."id" = "Payment"."userId"
    AND u."authUserId" = auth.uid()
    AND u."isActive"
));
GRANT SELECT ON public."Payment" TO authenticated;

CREATE POLICY "lendit_mobile_payment_profile_owner"
ON public."MobilePaymentProfile" FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public."User" u
  WHERE u."id" = "MobilePaymentProfile"."userId"
    AND u."authUserId" = auth.uid()
    AND u."isActive"
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public."User" u
  WHERE u."id" = "MobilePaymentProfile"."userId"
    AND u."authUserId" = auth.uid()
    AND u."isActive"
));

CREATE POLICY "lendit_wallet_account_owner_read"
ON public."WalletAccount" FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public."User" u
  WHERE u."id" = "WalletAccount"."userId"
    AND u."authUserId" = auth.uid()
    AND u."isActive"
));

CREATE POLICY "lendit_wallet_transaction_owner_read"
ON public."WalletTransaction" FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public."User" u
  WHERE u."id" = "WalletTransaction"."userId"
    AND u."authUserId" = auth.uid()
    AND u."isActive"
));
GRANT SELECT ON public."WalletAccount", public."WalletTransaction" TO authenticated;

CREATE OR REPLACE FUNCTION public.lendit_payment_proof_is_referenced(proof_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public."Payment" WHERE "proofPath" = proof_path);
$$;
REVOKE ALL ON FUNCTION public.lendit_payment_proof_is_referenced(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lendit_payment_proof_is_referenced(TEXT) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "lendit_payment_proof_owner_read" ON storage.objects;
CREATE POLICY "lendit_payment_proof_owner_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
);

DROP POLICY IF EXISTS "lendit_payment_proof_owner_insert" ON storage.objects;
CREATE POLICY "lendit_payment_proof_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
);

DROP POLICY IF EXISTS "lendit_payment_proof_delete_unreferenced" ON storage.objects;
CREATE POLICY "lendit_payment_proof_delete_unreferenced"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
  AND NOT public.lendit_payment_proof_is_referenced(name)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."WalletTransaction";
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
