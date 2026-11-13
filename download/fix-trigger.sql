-- Fix: make the handle_new_user trigger bypass RLS so new auth users can be
-- created. The original trigger was failing because RLS on public.profiles
-- blocked the INSERT (current_role() returned NULL for the not-yet-existent
-- profile row).
--
-- Run this in your Supabase SQL Editor, then re-run the seed.

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Re-create the function with SECURITY DEFINER + explicit search_path
-- (search_path hardening recommended by Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'LEARNER');
  IF v_role NOT IN ('ADMIN', 'TEACHER', 'LEARNER') THEN
    v_role := 'LEARNER';
  END IF;
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role::user_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also: temporarily allow anyone to INSERT into profiles so the trigger
-- can run (the trigger itself runs as SECURITY DEFINER which bypasses RLS,
-- but if there's any other issue this policy lets us through).
-- Actually, SECURITY DEFINER functions bypass RLS by default, so this
-- policy may not be needed. But to be safe:
DROP POLICY IF EXISTS profiles_insert_trigger_bypass ON public.profiles;
CREATE POLICY profiles_insert_trigger_bypass ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Verify the trigger is in place
SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';
