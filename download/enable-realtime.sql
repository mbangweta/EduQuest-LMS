-- ============================================================================
-- EduQuest LMS — Enable Supabase Realtime on all tables
-- ============================================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New Query).
-- After running, the app will receive live updates when rows are inserted,
-- updated, or deleted — no polling needed.
-- ============================================================================

-- Add every public table to the realtime publication.
-- `realtime` is a built-in Postgres publication that Supabase Realtime uses.
-- We only send INSERT/UPDATE/DELETE events (not TRUNCATE) for efficiency.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'subjects', 'classes', 'class_members',
      'lessons', 'lesson_assignments', 'lesson_progress',
      'quizzes', 'quiz_questions', 'quiz_assignments',
      'quiz_attempts', 'quiz_answers', 'question_bank',
      'notifications'
    )
  LOOP
    -- Add the table to the realtime publication (idempotent)
    BEGIN
      EXECUTE format('ALTER PUBLICATION realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Verify
SELECT tablename FROM pg_publication_tables WHERE pubname = 'realtime' ORDER BY tablename;
