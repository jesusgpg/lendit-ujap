-- Migración aditiva: imagen opcional y texto alternativo para escuelas y carreras,
-- y bucket de almacenamiento para imágenes administrativas del catálogo.
-- No elimina ni modifica datos existentes. Revisar antes de aplicar (prisma migrate deploy).
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "imagenUrl" VARCHAR(255);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "imagenAlt" VARCHAR(255);
ALTER TABLE "Career" ADD COLUMN IF NOT EXISTS "imagenUrl" VARCHAR(255);
ALTER TABLE "Career" ADD COLUMN IF NOT EXISTS "imagenAlt" VARCHAR(255);

-- Bucket público de lectura. Solo usuarios activos con categories.manage o
-- careers.manage pueden escribir/eliminar. En PostgreSQL local sin Supabase Storage se omite.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL
    OR to_regclass('storage.objects') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Supabase Storage no está disponible; se omite la configuración de catalog-images.';
    RETURN;
  END IF;

  EXECUTE $storage$
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('catalog-images', 'catalog-images', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
    ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_catalog_images_read" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_catalog_images_read"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'catalog-images')
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_catalog_images_insert" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_catalog_images_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'catalog-images'
        AND EXISTS (
          SELECT 1 FROM public."User" u
          JOIN public."RolePermission" rp ON rp."roleId" = u."roleId"
          JOIN public."Permission" p ON p."id" = rp."permissionId"
          WHERE u."authUserId" = auth.uid() AND u."isActive"
            AND p."key" IN ('categories.manage', 'careers.manage')
        )
      )
  $storage$;

  EXECUTE 'DROP POLICY IF EXISTS "lendit_catalog_images_delete" ON storage.objects';
  EXECUTE $storage$
    CREATE POLICY "lendit_catalog_images_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'catalog-images'
        AND EXISTS (
          SELECT 1 FROM public."User" u
          JOIN public."RolePermission" rp ON rp."roleId" = u."roleId"
          JOIN public."Permission" p ON p."id" = rp."permissionId"
          WHERE u."authUserId" = auth.uid() AND u."isActive"
            AND p."key" IN ('categories.manage', 'careers.manage')
        )
      )
  $storage$;
END
$$;
