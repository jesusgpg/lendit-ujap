-- Modalidad, precio opcional y foto almacenada para las publicaciones.
CREATE TYPE "ItemMode" AS ENUM ('LOAN', 'RENTAL');

ALTER TABLE "Item" ADD COLUMN "mode" "ItemMode" NOT NULL DEFAULT 'LOAN';
ALTER TABLE "Item" ADD COLUMN "price" DECIMAL(12,2);
ALTER TABLE "Item" ADD COLUMN "currency" "Currency";

ALTER TABLE "Item"
  ADD CONSTRAINT "Item_rental_price_check"
  CHECK ("mode" = 'LOAN' OR ("price" IS NOT NULL AND "price" > 0 AND "currency" IS NOT NULL));

-- Vincula un pago simulado con la solicitud que lo originó para poder
-- devolverlo si el propietario rechaza o el solicitante cancela.
ALTER TABLE "Payment" ADD COLUMN "requestId" UUID;
CREATE UNIQUE INDEX "Payment_requestId_key" ON "Payment"("requestId");
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "LoanRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bucket público: las URLs pueden mostrarse en el catálogo, pero solo el
-- usuario autenticado que creó la carpeta puede escribir o eliminar archivos.
-- En un PostgreSQL local sin el esquema de Storage, se omite esta parte para
-- que las migraciones de datos sigan siendo aplicables; las fotos requieren Supabase.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL
    OR to_regclass('storage.objects') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE NOTICE 'Supabase Storage no está disponible; se omite la configuración de item-photos.';
    RETURN;
  END IF;

  EXECUTE $storage$
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('item-photos', 'item-photos', true)
    ON CONFLICT (id) DO UPDATE SET public = true
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_item_photos_read" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_item_photos_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'item-photos')
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_item_photos_insert" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_item_photos_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'item-photos'
        AND (storage.foldername(name))[1] = (auth.uid())::text
      )
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_item_photos_update" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_item_photos_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'item-photos'
        AND (storage.foldername(name))[1] = (auth.uid())::text
      )
      WITH CHECK (
        bucket_id = 'item-photos'
        AND (storage.foldername(name))[1] = (auth.uid())::text
      )
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_item_photos_delete" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_item_photos_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'item-photos'
        AND (storage.foldername(name))[1] = (auth.uid())::text
      )
  $storage$;
END
$$;
