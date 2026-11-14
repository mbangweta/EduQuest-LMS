-- ============================================================================
-- EduQuest LMS — Attendance table migration
-- Run this in your Supabase Dashboard → SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  learner_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PRESENT',
  notes       TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  -- One record per learner per class per date
  UNIQUE(class_id, learner_id, date)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS attendance_class_date_idx
  ON public.attendance (class_id, date);
CREATE INDEX IF NOT EXISTS attendance_learner_idx
  ON public.attendance (learner_id);
CREATE INDEX IF NOT EXISTS attendance_school_idx
  ON public.attendance (school_id);

-- Allow the service role to read/write (RLS is handled at the app layer)
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy: anyone authenticated can read attendance in their school
CREATE POLICY "attendance_read_self_school" ON public.attendance
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
      )
      OR school_id IS NULL
    )
  );

-- Policy: teachers and school admins can insert/update
CREATE POLICY "attendance_write_self_school" ON public.attendance
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND (
      school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
      )
      OR school_id IS NULL
    )
  );

COMMENT ON TABLE public.attendance IS
  'Daily attendance records — one row per learner per class per date. Status: PRESENT, ABSENT, LATE, EXCUSED.';
