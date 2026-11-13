-- ============================================================================
-- EduQuest LMS — Make subject_id nullable on classes table
-- ============================================================================
-- For Grades 4-7, classes learn ALL subjects, so a class doesn't need to be
-- tied to a single subject. This migration makes subject_id optional.
--
-- Run this in the Supabase SQL Editor. Idempotent.
-- ============================================================================

ALTER TABLE public.classes ALTER COLUMN subject_id DROP NOT NULL;

-- Optional: update the class_code generation to handle NULL subjects.
-- (No SQL change needed — the API handles this in JavaScript.)
