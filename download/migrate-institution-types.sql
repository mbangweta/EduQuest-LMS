-- ============================================================================
-- EduQuest LMS — Schema migration for Institution Types + Personal Accounts
-- ----------------------------------------------------------------------------
-- Adds the columns needed for:
--   - School vs Personal account registration
--   - Personal-account restrictions (max 3 classes, max 10 learners)
--   - Mark Schedule + Report Card access control based on account type
--
-- Run this ONCE in your Supabase Dashboard → SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS).
-- ============================================================================

-- 1. Add institution_type to profiles (SCHOOL or PERSONAL; null = legacy)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS institution_type TEXT;

-- Backfill existing accounts: SCHOOL_ADMIN → 'SCHOOL', TEACHER without a
-- school_id → leave as null (they'll be treated as 'SCHOOL' for backwards
-- compatibility in the auth layer).
UPDATE public.profiles
  SET institution_type = 'SCHOOL'
  WHERE role IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_USER')
    AND institution_type IS NULL;

-- 2. Add secondary_phone to profiles (the spec asks for two phone numbers)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT;

-- 3. Add address to profiles (for personal accounts; schools already have it
--    in the schools table)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address TEXT;

-- 4. Add logo_url to profiles (for personal accounts; schools already have it
--    in the schools table)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 5. Add secondary_phone to schools (the spec asks for two phone numbers)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT;

-- 6. Add an index on institution_type for fast filtering
CREATE INDEX IF NOT EXISTS profiles_institution_type_idx
  ON public.profiles (institution_type);

-- 7. (Optional) Add a comment for future maintainers
COMMENT ON COLUMN public.profiles.institution_type IS
  'SCHOOL = full-access school admin account; PERSONAL = restricted individual teacher account (max 3 classes, max 10 learners, no mark schedule, no report cards).';

-- Done. No data is lost — all new columns are nullable.
