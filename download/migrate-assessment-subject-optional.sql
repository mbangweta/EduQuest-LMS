-- ============================================================================
-- EduQuest LMS — Make subject_id and weight optional on assessments
-- ============================================================================
-- Assessments created from a class context cover ALL subjects (for Grades 4-7),
-- so subject_id is no longer required. Weight is removed from the UI but kept
-- in the table with a default of 1.0 for backward compatibility.
--
-- Run this in the Supabase SQL Editor. Idempotent.
-- ============================================================================

-- Make subject_id nullable (assessments can cover all subjects)
ALTER TABLE public.assessments ALTER COLUMN subject_id DROP NOT NULL;

-- Ensure weight has a sensible default (already has one, but reinforce)
ALTER TABLE public.assessments ALTER COLUMN weight SET DEFAULT 1.0;
