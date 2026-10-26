-- Actualizar límite del bucket catalog-images a 5 MB (5242880 bytes)
-- y proteger contra el borrado de archivos referenciados en Category, School o Career.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets
    SET file_size_limit = 5242880
    WHERE id = 'catalog-images';
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL THEN
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
          AND NOT EXISTS (
            SELECT 1 FROM public."Category" c WHERE c."imagenUrl" LIKE '%' || storage.objects.name
          )
          AND NOT EXISTS (
            SELECT 1 FROM public."School" s WHERE s."imagenUrl" LIKE '%' || storage.objects.name
          )
          AND NOT EXISTS (
            SELECT 1 FROM public."Career" cr WHERE cr."imagenUrl" LIKE '%' || storage.objects.name
          )
        )
    $storage$;
  END IF;
END
$$;
