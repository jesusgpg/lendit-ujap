-- Carnet privado: solo el estudiante activo puede consultar o modificar su archivo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-cards', 'student-cards', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']);

CREATE POLICY "lendit_student_card_owner"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'student-cards'
  AND name = auth.uid()::text || '/carnet'
  AND EXISTS (SELECT 1 FROM public."User" u JOIN public."Role" r ON r.id = u."roleId"
    WHERE u."authUserId" = auth.uid() AND u."isActive" AND r.name = 'STUDENT')
)
WITH CHECK (
  bucket_id = 'student-cards'
  AND name = auth.uid()::text || '/carnet'
  AND EXISTS (SELECT 1 FROM public."User" u JOIN public."Role" r ON r.id = u."roleId"
    WHERE u."authUserId" = auth.uid() AND u."isActive" AND r.name = 'STUDENT')
);
