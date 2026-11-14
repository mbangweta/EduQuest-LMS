-- ============================================================================
-- EduQuest LMS — Timetable table
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random.uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id  UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL,  -- 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  period      INTEGER NOT NULL,  -- 1, 2, 3, ...
  start_time  TEXT,               -- "07:00"
  end_time    TEXT,               -- "07:40"
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, day_of_week, period)
);

CREATE INDEX IF NOT EXISTS timetable_class_idx ON public.timetable_slots (class_id);
CREATE INDEX IF NOT EXISTS timetable_teacher_idx ON public.timetable_slots (teacher_id);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timetable_read" ON public.timetable_slots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "timetable_write" ON public.timetable_slots FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.timetable_slots IS 'Weekly class timetable — one row per period per day per class.';
