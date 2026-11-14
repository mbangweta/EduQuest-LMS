-- ============================================================================
-- EduQuest LMS — Assignments + Submissions tables
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random.uuid(),
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id  UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'ASSIGNMENT',  -- ASSIGNMENT | HOMEWORK | PROJECT
  max_score   INTEGER NOT NULL DEFAULT 100,
  due_date    TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PUBLISHED',   -- DRAFT | PUBLISHED | CLOSED
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_class_idx ON public.assignments (class_id);
CREATE INDEX IF NOT EXISTS assignments_teacher_idx ON public.assignments (teacher_id);
CREATE INDEX IF NOT EXISTS assignments_due_date_idx ON public.assignments (due_date);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random.uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  learner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id      UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  content       TEXT,
  file_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'SUBMITTED',  -- SUBMITTED | LATE | GRADED
  score         REAL,
  feedback      TEXT,
  graded_by     UUID REFERENCES public.profiles(id),
  graded_at     TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, learner_id)
);

CREATE INDEX IF NOT EXISTS submissions_assignment_idx ON public.assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS submissions_learner_idx ON public.assignment_submissions (learner_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Policies: school members can read; teachers can write their own; learners can submit
CREATE POLICY "assignments_read" ON public.assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assignments_write" ON public.assignments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "submissions_read" ON public.assignment_submissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "submissions_write" ON public.assignment_submissions FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.assignments IS 'Homework assignments created by teachers for a class.';
COMMENT ON TABLE public.assignment_submissions IS 'Learner submissions + teacher grades/feedback.';
