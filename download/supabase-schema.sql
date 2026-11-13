-- ============================================================================
-- EduQuest LMS — Supabase Schema + Row Level Security (RLS)
-- ============================================================================
-- Run this entire script in the Supabase SQL Editor (Dashboard → SQL → New Query).
-- It is idempotent: it uses `IF NOT EXISTS` so you can re-run it safely.
--
-- After running this, set these env vars in your .env file:
--   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   (from Supabase → Settings → API → service_role)
--   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (from Supabase → Settings → API → anon)
--
-- Then run `bun run db:seed-supabase` to populate demo data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- ENUMS (Postgres native enums for type safety)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'TEACHER', 'LEARNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lesson_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quiz_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD', 'VERY_HARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE curriculum AS ENUM ('ZAMBIAN', 'ECZ', 'CAMBRIDGE', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL', 'MATCHING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE show_answers_mode AS ENUM ('NEVER', 'AFTER_SUBMISSION', 'AFTER_DEADLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE score_policy AS ENUM ('HIGHEST', 'LATEST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('NEW_QUIZ', 'NEW_LESSON', 'DEADLINE', 'SUBMISSION', 'RESULT', 'ANNOUNCEMENT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- PROFILES (mirrors auth.users; one row per Supabase Auth user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'LEARNER',
  phone       TEXT,
  grade       INT,
  status      user_status NOT NULL DEFAULT 'ACTIVE',
  avatar_color TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_grade_idx ON public.profiles(grade);
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create a profile row when a new auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
BEGIN
  -- Read role/name from raw_user_meta_data, defaulting safely
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SUBJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  description TEXT,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CLASSES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  grade       INT NOT NULL,
  subject_id  UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  description TEXT,
  class_code  TEXT UNIQUE NOT NULL,
  teacher_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS classes_subject_id_idx ON public.classes(subject_id);
DROP TRIGGER IF EXISTS classes_updated_at ON public.classes;
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- CLASS MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  learner_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, learner_id)
);
CREATE INDEX IF NOT EXISTS class_members_learner_id_idx ON public.class_members(learner_id);

-- ---------------------------------------------------------------------------
-- LESSONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  grade             INT NOT NULL,
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  topic             TEXT NOT NULL,
  objectives        TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  activities        TEXT,
  examples          TEXT,
  practice_questions TEXT,
  homework          TEXT,
  summary           TEXT,
  attachments       JSONB,  -- [{name, url, type, storage_path?}]
  video_links       JSONB,  -- ["https://...", ...]
  status            lesson_status NOT NULL DEFAULT 'DRAFT',
  teacher_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lessons_teacher_id_idx ON public.lessons(teacher_id);
CREATE INDEX IF NOT EXISTS lessons_subject_id_idx ON public.lessons(subject_id);
CREATE INDEX IF NOT EXISTS lessons_status_idx ON public.lessons(status);
DROP TRIGGER IF EXISTS lessons_updated_at ON public.lessons;
CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- LESSON ASSIGNMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  due_date    TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, class_id)
);
CREATE INDEX IF NOT EXISTS lesson_assignments_class_id_idx ON public.lesson_assignments(class_id);

-- ---------------------------------------------------------------------------
-- LESSON PROGRESS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  learner_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, learner_id)
);
CREATE INDEX IF NOT EXISTS lesson_progress_learner_id_idx ON public.lesson_progress(learner_id);
DROP TRIGGER IF EXISTS lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- QUIZZES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  grade               INT NOT NULL,
  subject_id          UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  topic               TEXT NOT NULL,
  description         TEXT,
  difficulty          difficulty NOT NULL DEFAULT 'MEDIUM',
  curriculum          curriculum NOT NULL DEFAULT 'ZAMBIAN',
  instructions        TEXT,
  time_limit          INT NOT NULL DEFAULT 30,
  passing_score       INT NOT NULL DEFAULT 50,
  max_attempts        INT NOT NULL DEFAULT 1,
  random_question_order BOOLEAN NOT NULL DEFAULT FALSE,
  random_answer_order BOOLEAN NOT NULL DEFAULT FALSE,
  allow_retakes       BOOLEAN NOT NULL DEFAULT TRUE,
  show_answers        show_answers_mode NOT NULL DEFAULT 'AFTER_SUBMISSION',
  show_explanations   BOOLEAN NOT NULL DEFAULT TRUE,
  score_policy        score_policy NOT NULL DEFAULT 'HIGHEST',
  status              quiz_status NOT NULL DEFAULT 'DRAFT',
  teacher_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quizzes_teacher_id_idx ON public.quizzes(teacher_id);
CREATE INDEX IF NOT EXISTS quizzes_subject_id_idx ON public.quizzes(subject_id);
CREATE INDEX IF NOT EXISTS quizzes_status_idx ON public.quizzes(status);
DROP TRIGGER IF EXISTS quizzes_updated_at ON public.quizzes;
CREATE TRIGGER quizzes_updated_at BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- QUIZ QUESTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id             UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type                question_type NOT NULL,
  question_text       TEXT NOT NULL,
  options             JSONB,         -- string[] for MC
  correct_answer      JSONB,         -- string | number | boolean | {left: right}
  accepted_answers   JSONB,         -- string[] for FILL_BLANK
  matching_pairs     JSONB,         -- [{left, right}]
  marking_guide      TEXT,           -- for SHORT_ANSWER (hidden from learner)
  numerical_tolerance DOUBLE PRECISION,
  mark_allocation    INT NOT NULL DEFAULT 1,
  explanation        TEXT,
  "order"            INT NOT NULL DEFAULT 0,
  question_bank_id   UUID REFERENCES public.question_bank(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_id_idx ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_questions_order_idx ON public.quiz_questions("order");

-- ---------------------------------------------------------------------------
-- QUIZ ASSIGNMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id    UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ,
  end_date   TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, class_id)
);
CREATE INDEX IF NOT EXISTS quiz_assignments_class_id_idx ON public.quiz_assignments(class_id);

-- ---------------------------------------------------------------------------
-- QUIZ ATTEMPTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  learner_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id  UUID REFERENCES public.quiz_assignments(id) ON DELETE SET NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at   TIMESTAMPTZ,
  status         attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  score          DOUBLE PRECISION,
  max_score      DOUBLE PRECISION,
  percentage     DOUBLE PRECISION,
  grade          TEXT,
  passed         BOOLEAN,
  time_spent     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_id_idx ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_learner_id_idx ON public.quiz_attempts(learner_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_assignment_id_idx ON public.quiz_attempts(assignment_id);

-- ---------------------------------------------------------------------------
-- QUIZ ANSWERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id        UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  learner_answer    JSONB,
  is_correct        BOOLEAN,
  marks_awarded     DOUBLE PRECISION,
  ai_marking_result  JSONB,
  teacher_override  BOOLEAN NOT NULL DEFAULT FALSE,
  graded_at         TIMESTAMPTZ,
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS quiz_answers_question_id_idx ON public.quiz_answers(question_id);

-- ---------------------------------------------------------------------------
-- QUESTION BANK (must be created BEFORE quiz_questions because of FK)
-- Note: we created it inline above with ON DELETE SET NULL — we need to ensure
-- the table exists. Move the CREATE here for clarity:
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_bank (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade               INT NOT NULL,
  subject_id          UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  topic               TEXT NOT NULL,
  type                question_type NOT NULL,
  question_text       TEXT NOT NULL,
  options             JSONB,
  correct_answer      JSONB,
  accepted_answers   JSONB,
  matching_pairs     JSONB,
  marking_guide      TEXT,
  numerical_tolerance DOUBLE PRECISION,
  mark_allocation    INT NOT NULL DEFAULT 1,
  explanation        TEXT,
  difficulty         difficulty NOT NULL DEFAULT 'MEDIUM',
  created_by_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS question_bank_subject_id_idx ON public.question_bank(subject_id);
CREATE INDEX IF NOT EXISTS question_bank_topic_idx ON public.question_bank(topic);
CREATE INDEX IF NOT EXISTS question_bank_created_by_id_idx ON public.question_bank(created_by_id);
DROP TRIGGER IF EXISTS question_bank_updated_at ON public.question_bank;
CREATE TRIGGER question_bank_updated_at BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add the FK from quiz_questions to question_bank now that question_bank exists
DO $$ BEGIN
  ALTER TABLE public.quiz_questions
    ADD CONSTRAINT quiz_questions_question_bank_id_fkey
    FOREIGN KEY (question_bank_id) REFERENCES public.question_bank(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at);

-- ---------------------------------------------------------------------------
-- STORAGE BUCKET for lesson attachments
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-attachments', 'lesson-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role (read from profiles via auth.uid())
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS user_role AS $$
DECLARE r user_role;
BEGIN
  SELECT role INTO r FROM public.profiles WHERE id = auth.uid();
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user a member of given class?
CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id AND learner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user the teacher of given class?
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user the teacher of given quiz?
CREATE OR REPLACE FUNCTION public.is_quiz_teacher(p_quiz_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.quizzes
    WHERE id = p_quiz_id AND teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user the teacher of given lesson?
CREATE OR REPLACE FUNCTION public.is_lesson_teacher(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.lessons
    WHERE id = p_lesson_id AND teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user assigned to a class with this quiz?
CREATE OR REPLACE FUNCTION public.is_quiz_assigned_to_me(p_quiz_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.quiz_assignments qa
    JOIN public.class_members cm ON cm.class_id = qa.class_id
    WHERE qa.quiz_id = p_quiz_id AND cm.learner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user assigned to a class with this lesson?
CREATE OR REPLACE FUNCTION public.is_lesson_assigned_to_me(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.lesson_assignments la
    JOIN public.class_members cm ON cm.class_id = la.class_id
    WHERE la.lesson_id = p_lesson_id AND cm.learner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- PROFILES RLS
-- ---------------------------------------------------------------------------
-- Admins see/edit all; users see/edit own profile; teachers can see profiles
-- of learners in their classes.
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE c.teacher_id = auth.uid() AND cm.learner_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR public.current_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (public.current_role() = 'ADMIN');

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE USING (public.current_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- SUBJECTS RLS — readable by all authenticated users; writable by admins
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS subjects_select_authenticated ON public.subjects;
CREATE POLICY subjects_select_authenticated ON public.subjects
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS subjects_admin_write ON public.subjects;
CREATE POLICY subjects_admin_write ON public.subjects
  FOR ALL USING (public.current_role() = 'ADMIN')
  WITH CHECK (public.current_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- CLASSES RLS
-- ---------------------------------------------------------------------------
-- Admin: all. Teacher: own classes. Learner: classes where they're a member.
DROP POLICY IF EXISTS classes_select_visible ON public.classes;
CREATE POLICY classes_select_visible ON public.classes
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR teacher_id = auth.uid()
    OR public.is_class_member(id)
  );

DROP POLICY IF EXISTS classes_teacher_or_admin_write ON public.classes;
CREATE POLICY classes_teacher_or_admin_write ON public.classes
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR teacher_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- CLASS MEMBERS RLS
-- ---------------------------------------------------------------------------
-- Admin: all. Teacher: members of own classes. Learner: own memberships.
DROP POLICY IF EXISTS class_members_select_visible ON public.class_members;
CREATE POLICY class_members_select_visible ON public.class_members
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR learner_id = auth.uid()
    OR public.is_class_teacher(class_id)
  );

DROP POLICY IF EXISTS class_members_teacher_or_admin_write ON public.class_members;
CREATE POLICY class_members_teacher_or_admin_write ON public.class_members
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR public.is_class_teacher(class_id)
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR public.is_class_teacher(class_id)
  );

-- ---------------------------------------------------------------------------
-- LESSONS RLS
-- ---------------------------------------------------------------------------
-- Admin: all. Teacher: own lessons. Learner: published lessons assigned to them.
DROP POLICY IF EXISTS lessons_select_visible ON public.lessons;
CREATE POLICY lessons_select_visible ON public.lessons
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR teacher_id = auth.uid()
    OR (status = 'PUBLISHED' AND public.is_lesson_assigned_to_me(id))
  );

DROP POLICY IF EXISTS lessons_teacher_or_admin_write ON public.lessons;
CREATE POLICY lessons_teacher_or_admin_write ON public.lessons
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR teacher_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- LESSON ASSIGNMENTS RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS lesson_assignments_select_visible ON public.lesson_assignments;
CREATE POLICY lesson_assignments_select_visible ON public.lesson_assignments
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR public.is_lesson_teacher(lesson_id)
    OR public.is_class_member(class_id)
  );

DROP POLICY IF EXISTS lesson_assignments_teacher_or_admin_write ON public.lesson_assignments;
CREATE POLICY lesson_assignments_teacher_or_admin_write ON public.lesson_assignments
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR public.is_lesson_teacher(lesson_id)
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR public.is_lesson_teacher(lesson_id)
  );

-- ---------------------------------------------------------------------------
-- LESSON PROGRESS RLS — learner owns their own progress
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS lesson_progress_select_visible ON public.lesson_progress;
CREATE POLICY lesson_progress_select_visible ON public.lesson_progress
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR learner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_id AND l.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lesson_progress_learner_or_admin_write ON public.lesson_progress;
CREATE POLICY lesson_progress_learner_or_admin_write ON public.lesson_progress
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR learner_id = auth.uid()
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR learner_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- QUIZZES RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS quizzes_select_visible ON public.quizzes;
CREATE POLICY quizzes_select_visible ON public.quizzes
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR teacher_id = auth.uid()
    OR (status = 'PUBLISHED' AND public.is_quiz_assigned_to_me(id))
  );

DROP POLICY IF EXISTS quizzes_teacher_or_admin_write ON public.quizzes;
CREATE POLICY quizzes_teacher_or_admin_write ON public.quizzes
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR teacher_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- QUIZ QUESTIONS RLS
-- ---------------------------------------------------------------------------
-- Teachers see their own quiz's questions (with answer keys).
-- Learners see questions of quizzes assigned to them — but answer keys
-- (correct_answer, accepted_answers, matching_pairs, marking_guide) are
-- EXCLUDED at the API layer (the API strips these fields before sending to
-- the learner). The RLS just gates row visibility.
DROP POLICY IF EXISTS quiz_questions_select_visible ON public.quiz_questions;
CREATE POLICY quiz_questions_select_visible ON public.quiz_questions
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR public.is_quiz_teacher(quiz_id)
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id
        AND q.status = 'PUBLISHED'
        AND public.is_quiz_assigned_to_me(quiz_id)
    )
  );

DROP POLICY IF EXISTS quiz_questions_teacher_or_admin_write ON public.quiz_questions;
CREATE POLICY quiz_questions_teacher_or_admin_write ON public.quiz_questions
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR public.is_quiz_teacher(quiz_id)
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR public.is_quiz_teacher(quiz_id)
  );

-- ---------------------------------------------------------------------------
-- QUIZ ASSIGNMENTS RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS quiz_assignments_select_visible ON public.quiz_assignments;
CREATE POLICY quiz_assignments_select_visible ON public.quiz_assignments
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR public.is_quiz_teacher(quiz_id)
    OR public.is_class_member(class_id)
  );

DROP POLICY IF EXISTS quiz_assignments_teacher_or_admin_write ON public.quiz_assignments;
CREATE POLICY quiz_assignments_teacher_or_admin_write ON public.quiz_assignments
  FOR ALL USING (
    public.current_role() = 'ADMIN' OR public.is_quiz_teacher(quiz_id)
  )
  WITH CHECK (
    public.current_role() = 'ADMIN' OR public.is_quiz_teacher(quiz_id)
  );

-- ---------------------------------------------------------------------------
-- QUIZ ATTEMPTS RLS — learner owns own attempts; teacher sees attempts in
-- their quizzes; admin sees all.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS quiz_attempts_select_visible ON public.quiz_attempts;
CREATE POLICY quiz_attempts_select_visible ON public.quiz_attempts
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR learner_id = auth.uid()
    OR public.is_quiz_teacher(quiz_id)
  );

-- Learners create their own attempts; teacher/admin cannot create attempts
-- for others.
DROP POLICY IF EXISTS quiz_attempts_learner_insert ON public.quiz_attempts;
CREATE POLICY quiz_attempts_learner_insert ON public.quiz_attempts
  FOR INSERT WITH CHECK (learner_id = auth.uid());

-- Learners can update their own attempts (to mark as submitted).
DROP POLICY IF EXISTS quiz_attempts_learner_update ON public.quiz_attempts;
CREATE POLICY quiz_attempts_learner_update ON public.quiz_attempts
  FOR UPDATE USING (learner_id = auth.uid() OR public.current_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- QUIZ ANSWERS RLS — answer belongs to an attempt; learner owns attempt.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS quiz_answers_select_visible ON public.quiz_answers;
CREATE POLICY quiz_answers_select_visible ON public.quiz_answers
  FOR SELECT USING (
    public.current_role() = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_id
        AND (qa.learner_id = auth.uid() OR public.is_quiz_teacher(qa.quiz_id))
    )
  );

DROP POLICY IF EXISTS quiz_answers_insert_learner ON public.quiz_answers;
CREATE POLICY quiz_answers_insert_learner ON public.quiz_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_id AND qa.learner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quiz_answers_update_owner_or_teacher ON public.quiz_answers;
CREATE POLICY quiz_answers_update_owner_or_teacher ON public.quiz_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_id
        AND (qa.learner_id = auth.uid() OR public.is_quiz_teacher(qa.quiz_id))
    )
  );

-- ---------------------------------------------------------------------------
-- QUESTION BANK RLS — admin: all; teacher: own + reusable; learner: no access.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS question_bank_select_visible ON public.question_bank;
CREATE POLICY question_bank_select_visible ON public.question_bank
  FOR SELECT USING (
    public.current_role() = 'ADMIN' OR public.current_role() = 'TEACHER'
  );

DROP POLICY IF EXISTS question_bank_teacher_or_admin_write ON public.question_bank;
CREATE POLICY question_bank_teacher_or_admin_write ON public.question_bank
  FOR ALL USING (
    public.current_role() = 'ADMIN'
    OR (public.current_role() = 'TEACHER' AND created_by_id = auth.uid())
  )
  WITH CHECK (
    public.current_role() = 'ADMIN'
    OR (public.current_role() = 'TEACHER' AND created_by_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS RLS — user owns own notifications.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS notifications_owner ON public.notifications;
CREATE POLICY notifications_owner ON public.notifications
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- STORAGE POLICIES for the lesson-attachments bucket
-- ---------------------------------------------------------------------------
-- Authenticated users can read all attachments (they're public).
-- Teachers can upload into a path keyed by their user id.
-- A teacher can delete objects in their own folder; admins can delete any.
DROP POLICY IF EXISTS attachments_read ON storage.objects;
CREATE POLICY attachments_read ON storage.objects
  FOR SELECT USING (bucket_id = 'lesson-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS attachments_insert ON storage.objects;
CREATE POLICY attachments_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lesson-attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS attachments_update ON storage.objects;
CREATE POLICY attachments_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'lesson-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS attachments_delete ON storage.objects;
CREATE POLICY attachments_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'lesson-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.current_role() = 'ADMIN'
    )
  );

-- ===========================================================================
-- DONE. Schema + RLS ready.
-- ===========================================================================
