-- Keep the Prisma profile in sync with Supabase Auth from the moment a user signs up.
-- Passwords remain exclusively managed by Supabase Auth.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."User" (
    "id",
    "authUserId",
    "email",
    "firstName",
    "lastName",
    "career",
    "phone",
    "photoUrl",
    "emailVerifiedAt",
    "role",
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
    COALESCE(NEW.raw_user_meta_data ->> 'career', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    NULL,
    NEW.email_confirmed_at,
    'STUDENT',
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT ("authUserId") DO UPDATE SET
    "email" = EXCLUDED."email",
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public."User"
  SET
    "email" = lower(NEW.email),
    "emailVerifiedAt" = NEW.email_confirmed_at,
    "updatedAt" = NOW()
  WHERE "authUserId" = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_update();
