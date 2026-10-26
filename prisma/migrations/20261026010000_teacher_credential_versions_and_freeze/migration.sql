-- Correcciones de seguridad del flujo docente (aditiva; no modifica la migración 20261025070000 ya aplicada).
-- 1) Versiona cada envío de credencial y conserva la evidencia revisada.
-- 2) Congela en Storage los documentos referenciados (sin UPDATE; DELETE solo de cargas no referenciadas).
-- 3) Cierra la exposición por Data API de las tablas docentes (RLS sin políticas; el backend usa Prisma).
-- 4) El trigger de alta deja de asignar carreras arbitrarias y rechaza escuela/carrera incompatibles.

-- CreateTable TeacherCredentialSubmission: instantánea inmutable de cada versión enviada a revisión.
CREATE TABLE "TeacherCredentialSubmission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verificationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "schoolId" UUID NOT NULL,
    "department" VARCHAR(120),
    "careerId" UUID,
    "documentPath" VARCHAR(255) NOT NULL,
    "documentMime" VARCHAR(40) NOT NULL,
    "documentBytes" INTEGER NOT NULL,
    "documentSha256" CHAR(64) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCredentialSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherCredentialSubmission_verificationId_version_key" ON "TeacherCredentialSubmission"("verificationId", "version");
CREATE INDEX "TeacherCredentialSubmission_documentPath_idx" ON "TeacherCredentialSubmission"("documentPath");

ALTER TABLE "TeacherCredentialSubmission" ADD CONSTRAINT "TeacherCredentialSubmission_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "TeacherVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherCredentialSubmission" ADD CONSTRAINT "TeacherCredentialSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherCredentialSubmission" ADD CONSTRAINT "TeacherCredentialSubmission_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Versión enviada actualmente en revisión/aprobada (null mientras no hay envío).
ALTER TABLE "TeacherVerification" ADD COLUMN "submittedVersion" INTEGER;

-- Backfill: conserva como instantánea las verificaciones ya enviadas (sin hash conocido del archivo previo).
INSERT INTO "TeacherCredentialSubmission" ("verificationId", "version", "schoolId", "department", "careerId", "documentPath", "documentMime", "documentBytes", "documentSha256", "submittedAt")
SELECT tv."id", tv."version", tv."schoolId", tv."department", tv."careerId", tv."documentPath",
       COALESCE(o.metadata ->> 'mimetype', 'unknown'),
       COALESCE((o.metadata ->> 'size')::INTEGER, 0),
       repeat('0', 64),
       tv."updatedAt"
FROM "TeacherVerification" tv
LEFT JOIN storage.objects o ON o.bucket_id = 'teacher-credentials' AND o.name = tv."documentPath"
WHERE tv."documentPath" IS NOT NULL AND tv."status" <> 'DRAFT'
ON CONFLICT DO NOTHING;

UPDATE "TeacherVerification" SET "submittedVersion" = "version"
WHERE "documentPath" IS NOT NULL AND "status" <> 'DRAFT';

-- Tablas docentes: solo accesibles desde el backend (Prisma usa un rol propietario que omite RLS).
ALTER TABLE "TeacherVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherVerificationDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherCredentialSubmission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "TeacherVerification" FROM anon, authenticated;
REVOKE ALL ON "TeacherVerificationDecision" FROM anon, authenticated;
REVOKE ALL ON "TeacherCredentialSubmission" FROM anon, authenticated;

-- ¿El objeto está referenciado por algún envío o por la verificación vigente? (evita depender de grants del navegador)
CREATE OR REPLACE FUNCTION public.lendit_teacher_credential_is_referenced(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM "TeacherCredentialSubmission" s WHERE s."documentPath" = object_name)
      OR EXISTS (SELECT 1 FROM "TeacherVerification" v WHERE v."documentPath" = object_name);
$$;
REVOKE ALL ON FUNCTION public.lendit_teacher_credential_is_referenced(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lendit_teacher_credential_is_referenced(TEXT) TO authenticated;

-- Storage: sustituye la política FOR ALL del propietario por políticas por operación.
DROP POLICY IF EXISTS "lendit_teacher_credential_owner" ON storage.objects;
DROP POLICY IF EXISTS "lendit_teacher_credential_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "lendit_teacher_credential_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "lendit_teacher_credential_owner_delete_unreferenced" ON storage.objects;

CREATE POLICY "lendit_teacher_credential_owner_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'teacher-credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
);

CREATE POLICY "lendit_teacher_credential_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'teacher-credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
);

-- Sin política UPDATE: ningún objeto puede sobrescribirse ni moverse (upsert/move) desde el navegador.
-- DELETE solo para cargas propias que nunca se enviaron (limpieza de temporales/fallidas).
CREATE POLICY "lendit_teacher_credential_owner_delete_unreferenced"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'teacher-credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
  AND NOT public.lendit_teacher_credential_is_referenced(name)
);

-- Trigger de alta: sin carrera por defecto y con validación de compatibilidad escuela/carrera.
-- Estudiante sin carrera => perfil incompleto (careerId NULL) que no puede operar hasta completarla.
-- Valores inválidos o incompatibles => la creación de la cuenta se rechaza.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  requested_career_id TEXT;
  requested_school_id TEXT;
  requested_department TEXT;
  resolved_role_id UUID;
  resolved_school_id UUID;
  resolved_career_id UUID;
  career_school_id UUID;
  new_user_id UUID;
BEGIN
  requested_role := UPPER(COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'STUDENT'));
  IF requested_role <> 'PROFESSOR' THEN
    requested_role := 'STUDENT';
  END IF;

  -- Toda alta recibe STUDENT como rol base; PROFESSOR solo por aprobación administrativa.
  SELECT id INTO resolved_role_id FROM "Role" WHERE name = 'STUDENT';

  requested_career_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'careerId', '')), '');
  IF requested_career_id IS NOT NULL THEN
    IF requested_career_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'LENDIT_INVALID_CAREER' USING ERRCODE = '22023';
    END IF;
    SELECT id, "schoolId" INTO resolved_career_id, career_school_id FROM "Career" WHERE id = requested_career_id::UUID;
    IF resolved_career_id IS NULL THEN
      RAISE EXCEPTION 'LENDIT_CAREER_NOT_FOUND' USING ERRCODE = '22023';
    END IF;
  END IF;

  requested_school_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'schoolId', '')), '');
  IF requested_school_id IS NOT NULL THEN
    IF requested_school_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'LENDIT_INVALID_SCHOOL' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO resolved_school_id FROM "School" WHERE id = requested_school_id::UUID;
    IF resolved_school_id IS NULL THEN
      RAISE EXCEPTION 'LENDIT_SCHOOL_NOT_FOUND' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF resolved_career_id IS NOT NULL THEN
    IF resolved_school_id IS NOT NULL AND career_school_id IS DISTINCT FROM resolved_school_id THEN
      RAISE EXCEPTION 'LENDIT_CAREER_SCHOOL_MISMATCH' USING ERRCODE = '22023';
    END IF;
    resolved_school_id := COALESCE(resolved_school_id, career_school_id);
  END IF;

  IF requested_role = 'PROFESSOR' AND resolved_school_id IS NULL THEN
    RAISE EXCEPTION 'LENDIT_SCHOOL_REQUIRED_FOR_PROFESSOR' USING ERRCODE = '22023';
  END IF;

  requested_department := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'department', '')), '');
  IF requested_department IS NOT NULL AND length(requested_department) > 120 THEN
    RAISE EXCEPTION 'LENDIT_DEPARTMENT_TOO_LONG' USING ERRCODE = '22023';
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO public."User" AS existing (
    "id", "authUserId", "email", "firstName", "lastName", "roleId", "schoolId", "department", "careerId",
    "phone", "photoUrl", "emailVerifiedAt", "reliabilityScore", "reliabilityReviewCount", "createdAt", "updatedAt"
  )
  VALUES (
    new_user_id,
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'firstName', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'lastName', ''),
    resolved_role_id,
    resolved_school_id,
    CASE WHEN requested_role = 'PROFESSOR' THEN requested_department ELSE NULL END,
    resolved_career_id,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'photoUrl', ''),
    NEW.email_confirmed_at,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT ("authUserId") DO UPDATE SET
    "email" = EXCLUDED."email",
    "photoUrl" = COALESCE(EXCLUDED."photoUrl", existing."photoUrl"),
    "updatedAt" = NOW()
  RETURNING id INTO new_user_id;

  IF requested_role = 'PROFESSOR' THEN
    INSERT INTO public."TeacherVerification" ("id", "userId", "schoolId", "department", "careerId", "status", "version", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), new_user_id, resolved_school_id, requested_department, resolved_career_id, 'DRAFT'::"TeacherVerificationStatus", 1, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
