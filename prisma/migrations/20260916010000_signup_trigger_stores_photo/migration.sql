-- Conserva la foto optimizada que el registro guarda en los metadatos de Auth.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  requested_career_id TEXT;
  resolved_role_id UUID;
  resolved_career_id UUID;
BEGIN
  requested_role := UPPER(COALESCE(NEW.raw_user_meta_data ->> 'role', 'STUDENT'));
  IF requested_role NOT IN ('STUDENT', 'PROFESSOR') THEN
    requested_role := 'STUDENT';
  END IF;

  SELECT id INTO resolved_role_id FROM "Role" WHERE name = requested_role;

  requested_career_id := NEW.raw_user_meta_data ->> 'careerId';
  IF requested_career_id IS NOT NULL AND requested_career_id ~* '^[0-9a-f-]{36}$' THEN
    SELECT id INTO resolved_career_id FROM "Career" WHERE id = requested_career_id::UUID;
  END IF;
  IF resolved_career_id IS NULL THEN
    SELECT id INTO resolved_career_id FROM "Career" ORDER BY name LIMIT 1;
  END IF;

  INSERT INTO public."User" AS existing (
    "id",
    "authUserId",
    "email",
    "firstName",
    "lastName",
    "roleId",
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
    gen_random_uuid(),
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'firstName', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'lastName', ''),
    resolved_role_id,
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
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$;
