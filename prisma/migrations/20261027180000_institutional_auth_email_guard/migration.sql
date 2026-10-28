-- Enforce the campus email rule at Supabase Auth's database boundary too.
-- This blocks direct Auth API signups that bypass the Vue form.
CREATE OR REPLACE FUNCTION public.lendit_enforce_institutional_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email !~* '^[^[:space:]@]+@ujap\.edu\.ve$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'INSTITUTIONAL_EMAIL_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lendit_enforce_institutional_auth_email() FROM PUBLIC;

DROP TRIGGER IF EXISTS lendit_require_institutional_email ON auth.users;
CREATE TRIGGER lendit_require_institutional_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.lendit_enforce_institutional_auth_email();
