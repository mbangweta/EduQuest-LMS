-- ============================================================================
-- EduQuest LMS — Add motto, website, logo columns to schools table
-- ============================================================================
-- Run this in the Supabase SQL Editor. Idempotent.

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS motto TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Optional: set a default motto for existing schools
-- UPDATE public.schools SET motto = 'Towards A Brighter Future' WHERE motto IS NULL;
