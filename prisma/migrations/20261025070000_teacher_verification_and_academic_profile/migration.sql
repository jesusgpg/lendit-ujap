-- AlterTable: User schoolId, department, careerId nullable
ALTER TABLE "User" ADD COLUMN "schoolId" UUID;
ALTER TABLE "User" ADD COLUMN "department" VARCHAR(120);
ALTER TABLE "User" ALTER COLUMN "careerId" DROP NOT NULL;

-- Backfill: Assign schoolId to existing users based on career.schoolId
UPDATE "User" u
SET "schoolId" = c."schoolId"
FROM "Career" c
WHERE u."careerId" = c."id" AND u."schoolId" IS NULL;

-- CreateEnum
CREATE TYPE "TeacherVerificationStatus" AS ENUM ('DRAFT', 'PENDING', 'NEEDS_CORRECTION', 'REJECTED', 'APPROVED');
CREATE TYPE "TeacherDecisionAction" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CORRECTION');

-- CreateTable TeacherVerification
CREATE TABLE "TeacherVerification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "department" VARCHAR(120),
    "careerId" UUID,
    "documentPath" VARCHAR(255),
    "status" "TeacherVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable TeacherVerificationDecision
CREATE TABLE "TeacherVerificationDecision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verificationId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" "TeacherDecisionAction" NOT NULL,
    "reason" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherVerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherVerification_userId_key" ON "TeacherVerification"("userId");
CREATE INDEX "TeacherVerification_status_idx" ON "TeacherVerification"("status");
CREATE INDEX "TeacherVerification_schoolId_idx" ON "TeacherVerification"("schoolId");
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");
CREATE INDEX "TeacherVerificationDecision_verificationId_createdAt_idx" ON "TeacherVerificationDecision"("verificationId", "createdAt");
CREATE INDEX "TeacherVerificationDecision_adminId_idx" ON "TeacherVerificationDecision"("adminId");

-- AddForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_careerId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherVerification" ADD CONSTRAINT "TeacherVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherVerification" ADD CONSTRAINT "TeacherVerification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherVerification" ADD CONSTRAINT "TeacherVerification_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherVerificationDecision" ADD CONSTRAINT "TeacherVerificationDecision_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "TeacherVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherVerificationDecision" ADD CONSTRAINT "TeacherVerificationDecision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permissions: Seed 'teachers.review' and grant to 'ADMIN'
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES (gen_random_uuid(), 'teachers.review', 'Revisar y dictaminar verificaciones de docentes', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r, "Permission" p
WHERE r.name = 'ADMIN' AND p.key = 'teachers.review'
ON CONFLICT DO NOTHING;

-- Private Storage Bucket: teacher-credentials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('teacher-credentials', 'teacher-credentials', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: Owner access for active user
DROP POLICY IF EXISTS "lendit_teacher_credential_owner" ON storage.objects;
CREATE POLICY "lendit_teacher_credential_owner"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'teacher-credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
)
WITH CHECK (
  bucket_id = 'teacher-credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public."User" u WHERE u."authUserId" = auth.uid() AND u."isActive")
);

-- Storage RLS: Reviewer access for users with teachers.review permission
DROP POLICY IF EXISTS "lendit_teacher_credential_reviewer" ON storage.objects;
CREATE POLICY "lendit_teacher_credential_reviewer"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'teacher-credentials'
  AND EXISTS (
    SELECT 1 FROM public."User" u
    JOIN public."RolePermission" rp ON rp."roleId" = u."roleId"
    JOIN public."Permission" p ON p.id = rp."permissionId"
    WHERE u."authUserId" = auth.uid()
      AND u."isActive"
      AND p.key = 'teachers.review'
  )
);

-- Updated trigger: Prevent self-assignment of PROFESSOR role.
-- Teacher registrations create account with STUDENT role and an initial TeacherVerification in DRAFT.
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
  new_user_id UUID;
BEGIN
  requested_role := UPPER(COALESCE(NEW.raw_user_meta_data ->> 'role', 'STUDENT'));

  -- All new signups receive base STUDENT role by default.
  -- PROFESSOR role is never granted directly via signup metadata; it requires administrative approval.
  SELECT id INTO resolved_role_id FROM "Role" WHERE name = 'STUDENT';

  requested_career_id := NEW.raw_user_meta_data ->> 'careerId';
  IF requested_career_id IS NOT NULL AND requested_career_id ~* '^[0-9a-f-]{36}$' THEN
    SELECT id, "schoolId" INTO resolved_career_id, resolved_school_id FROM "Career" WHERE id = requested_career_id::UUID;
  END IF;

  requested_school_id := NEW.raw_user_meta_data ->> 'schoolId';
  IF requested_school_id IS NOT NULL AND requested_school_id ~* '^[0-9a-f-]{36}$' THEN
    SELECT id INTO resolved_school_id FROM "School" WHERE id = requested_school_id::UUID;
  END IF;

  requested_department := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'department', '')), '');
  IF requested_department IS NOT NULL AND length(requested_department) > 120 THEN
    requested_department := substring(requested_department from 1 for 120);
  END IF;

  -- For student signups, career is mandatory. Fallback to first career if not resolved.
  IF requested_role = 'STUDENT' AND resolved_career_id IS NULL THEN
    SELECT id, "schoolId" INTO resolved_career_id, resolved_school_id FROM "Career" ORDER BY name LIMIT 1;
  END IF;

  -- If school is still null but career is resolved, derive school from career.
  IF resolved_school_id IS NULL AND resolved_career_id IS NOT NULL THEN
    SELECT "schoolId" INTO resolved_school_id FROM "Career" WHERE id = resolved_career_id;
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO public."User" AS existing (
    "id",
    "authUserId",
    "email",
    "firstName",
    "lastName",
    "roleId",
    "schoolId",
    "department",
    "careerId",
    "phone",
    "photoUrl",
    "emailVerifiedAt",
    "reliabilityScore",
    "reliabilityReviewCount",
    "createdAt",
    "updatedAt"
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

  -- If user registered as teacher applicant, initialize TeacherVerification in DRAFT
  IF requested_role = 'PROFESSOR' AND resolved_school_id IS NOT NULL THEN
    INSERT INTO public."TeacherVerification" (
      "id",
      "userId",
      "schoolId",
      "department",
      "careerId",
      "status",
      "version",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid(),
      new_user_id,
      resolved_school_id,
      requested_department,
      resolved_career_id,
      'DRAFT'::"TeacherVerificationStatus",
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
