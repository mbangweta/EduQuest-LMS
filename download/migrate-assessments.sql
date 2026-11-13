-- ============================================================================
-- EduQuest LMS — Assessments + Scores (Continuous Assessment → Mark Schedule → Report Card)
-- ============================================================================
-- Run this in the Supabase SQL Editor after the main schema (db/supabase-schema.sql).
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
-- NOTE: assessment type and status are stored as TEXT (not Postgres enums)
-- to avoid ALTER TYPE ADD VALUE transaction issues. The API validates values.
DO $$ BEGIN
  CREATE TYPE assessment_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- ASSESSMENTS (a test / assignment / project / exam given to a class)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id  UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  type              TEXT NOT NULL DEFAULT 'FORTNIGHTLY',
  term              INT NOT NULL DEFAULT 1 CHECK (term IN (1, 2, 3)),
  subject_id        UUID REFERENCES public.subjects(id) ON DELETE RESTRICT,
  grade             INT NOT NULL,
  class_id          UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  max_score         INT NOT NULL DEFAULT 100 CHECK (max_score > 0),
  weight            NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  status            TEXT NOT NULL DEFAULT 'DRAFT',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assessments_teacher_id_idx ON public.assessments(teacher_id);
CREATE INDEX IF NOT EXISTS assessments_subject_id_idx ON public.assessments(subject_id);
CREATE INDEX IF NOT EXISTS assessments_class_id_idx ON public.assessments(class_id);
CREATE INDEX IF NOT EXISTS assessments_school_id_idx ON public.assessments(school_id);
CREATE INDEX IF NOT EXISTS assessments_term_idx ON public.assessments(term);
CREATE INDEX IF NOT EXISTS assessments_grade_idx ON public.assessments(grade);

DROP TRIGGER IF EXISTS assessments_updated_at ON public.assessments;
CREATE TRIGGER assessments_updated_at BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- ASSESSMENT SCORES (one row per learner per assessment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  learner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score           NUMERIC(6,2),  -- NULL = not yet recorded
  remarks         TEXT,
  recorded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, learner_id)
);
CREATE INDEX IF NOT EXISTS assessment_scores_learner_id_idx ON public.assessment_scores(learner_id);
CREATE INDEX IF NOT EXISTS assessment_scores_assessment_id_idx ON public.assessment_scores(assessment_id);

DROP TRIGGER IF EXISTS assessment_scores_updated_at ON public.assessment_scores;
CREATE TRIGGER assessment_scores_updated_at BEFORE UPDATE ON public.assessment_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — Assessments
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- SELECT: super users, school members (same school), the teacher who created it
DROP POLICY IF EXISTS assessments_select_visible ON public.assessments;
CREATE POLICY assessments_select_visible ON public.assessments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'))
    AND (
      -- super user: any assessment
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'SUPER_USER')
      -- same school
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.school_id = assessments.school_id
      )
    )
  );

-- WRITE: only the teacher who owns the assessment, or a school admin of the same school, or super user
DROP POLICY IF EXISTS assessments_teacher_or_admin_write ON public.assessments;
CREATE POLICY assessments_teacher_or_admin_write ON public.assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'SUPER_USER'
      OR (p.role = 'SCHOOL_ADMIN' AND p.school_id = assessments.school_id)
      OR (p.role = 'TEACHER' AND p.id = assessments.teacher_id)
    ))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'SUPER_USER'
      OR (p.role = 'SCHOOL_ADMIN' AND p.school_id = assessments.school_id)
      OR (p.role = 'TEACHER' AND p.id = assessments.teacher_id)
    ))
  );

-- ---------------------------------------------------------------------------
-- RLS — Assessment Scores
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;

-- SELECT: super user, school admin of the school, teacher who owns the assessment,
-- learner viewing their own scores
DROP POLICY IF EXISTS assessment_scores_select_visible ON public.assessment_scores;
CREATE POLICY assessment_scores_select_visible ON public.assessment_scores
  FOR SELECT USING (
    -- own score
    learner_id = auth.uid()
    -- super user
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'SUPER_USER')
    -- school admin of the school the assessment belongs to
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.assessments a ON a.school_id = p.school_id
      WHERE p.id = auth.uid() AND p.role = 'SCHOOL_ADMIN' AND a.id = assessment_scores.assessment_id
    )
    -- teacher who owns the assessment
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.assessments a ON a.teacher_id = p.id
      WHERE p.id = auth.uid() AND p.role = 'TEACHER' AND a.id = assessment_scores.assessment_id
    )
  );

-- WRITE: teacher who owns the assessment, school admin of the school, or super user
DROP POLICY IF EXISTS assessment_scores_teacher_or_admin_write ON public.assessment_scores;
CREATE POLICY assessment_scores_teacher_or_admin_write ON public.assessment_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'SUPER_USER'
      OR (p.role = 'SCHOOL_ADMIN' AND EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.id = assessment_scores.assessment_id AND a.school_id = p.school_id
      ))
      OR (p.role = 'TEACHER' AND EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.id = assessment_scores.assessment_id AND a.teacher_id = p.id
      ))
    ))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'SUPER_USER'
      OR (p.role = 'SCHOOL_ADMIN' AND EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.id = assessment_scores.assessment_id AND a.school_id = p.school_id
      ))
      OR (p.role = 'TEACHER' AND EXISTS (
        SELECT 1 FROM public.assessments a
        WHERE a.id = assessment_scores.assessment_id AND a.teacher_id = p.id
      ))
    ))
  );
