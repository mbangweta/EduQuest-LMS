-- ============================================================================
-- EduQuest LMS — Multi-School RBAC Migration
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query).
-- Idempotent — safe to re-run.
--
-- This migration adds:
--   1. SUPER_USER to the user_role enum
--   2. New `schools` table
--   3. `school_id` column on profiles, classes, lessons, quizzes, question_bank, notifications
--   4. New `library_resources` table (test papers / past exam papers, school-scoped or global)
--   5. New `teacher_class_assignments` table (explicit teacher ↔ class link)
--   6. A default school "EduQuest Demo School" (code: EQS-DEMO)
--   7. Backfill: existing rows get school_id = demo school
--   8. Promote admin@eduquest.zm to SUPER_USER
--   9. RLS policy updates — drop & recreate with school-scoped checks
--  10. Realtime publication updates
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add SUPER_USER to user_role enum
-- ---------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPER_USER';

-- ---------------------------------------------------------------------------
-- 2. Create schools table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  address     TEXT,
  phone       TEXT,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | DISABLED
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS schools_updated_at ON public.schools;
CREATE TRIGGER schools_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS schools_status_idx ON public.schools(status);

-- ---------------------------------------------------------------------------
-- 3. Add school_id to existing tables (nullable initially — backfilled below)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.classes       ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.lessons       ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.quizzes       ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_school_id_idx      ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS classes_school_id_idx       ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS lessons_school_id_idx        ON public.lessons(school_id);
CREATE INDEX IF NOT EXISTS quizzes_school_id_idx        ON public.quizzes(school_id);
CREATE INDEX IF NOT EXISTS question_bank_school_id_idx ON public.question_bank(school_id);
CREATE INDEX IF NOT EXISTS notifications_school_id_idx ON public.notifications(school_id);

-- ---------------------------------------------------------------------------
-- 4. library_resources table (test papers / past exam papers)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.library_paper_type AS ENUM ('TEST', 'EXAM', 'WORKSHEET', 'NOTES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_resources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID REFERENCES public.schools(id) ON DELETE CASCADE,  -- NULL = global (all schools)
  title          TEXT NOT NULL,
  description     TEXT,
  subject_id     UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  grade          INT,
  year           INT,
  paper_type     public.library_paper_type NOT NULL DEFAULT 'EXAM',
  file_url       TEXT NOT NULL,
  file_type      TEXT,    -- 'pdf', 'image', 'docx', etc.
  file_size      INT,
  uploaded_by_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status         TEXT NOT NULL DEFAULT 'PUBLISHED',  -- DRAFT | PUBLISHED | ARCHIVED
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS library_resources_school_id_idx  ON public.library_resources(school_id);
CREATE INDEX IF NOT EXISTS library_resources_subject_id_idx ON public.library_resources(subject_id);
CREATE INDEX IF NOT EXISTS library_resources_grade_idx      ON public.library_resources(grade);
CREATE INDEX IF NOT EXISTS library_resources_status_idx     ON public.library_resources(status);
DROP TRIGGER IF EXISTS library_resources_updated_at ON public.library_resources;
CREATE TRIGGER library_resources_updated_at BEFORE UPDATE ON public.library_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. teacher_class_assignments (explicit teacher ↔ class link, multi-class)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, class_id)
);
CREATE INDEX IF NOT EXISTS teacher_class_assignments_teacher_id_idx ON public.teacher_class_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS teacher_class_assignments_class_id_idx   ON public.teacher_class_assignments(class_id);

-- ---------------------------------------------------------------------------
-- 6. Create the default demo school
-- ---------------------------------------------------------------------------
INSERT INTO public.schools (name, code, address, phone, email, status)
VALUES (
  'EduQuest Demo School',
  'EQS-DEMO',
  'Plot 123, Independence Avenue, Lusaka, Zambia',
  '+260 211 000 000',
  'demo@eduquest.zm',
  'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Backfill school_id on all existing rows to the demo school
-- ---------------------------------------------------------------------------
UPDATE public.profiles      SET school_id = (SELECT id FROM public.schools WHERE code = 'EQS-DEMO' LIMIT 1) WHERE school_id IS NULL;
UPDATE public.classes       SET school_id = (SELECT id FROM public.schools WHERE code = 'EQS-DEMO' LIMIT 1) WHERE school_id IS NULL;
UPDATE public.lessons       SET school_id = (SELECT id FROM public.schools WHERE code = 'EQS-DEMO' LIMIT 1) WHERE school_id IS NULL;
UPDATE public.quizzes       SET school_id = (SELECT id FROM public.schools WHERE code = 'EQS-DEMO' LIMIT 1) WHERE school_id IS NULL;
UPDATE public.question_bank SET school_id = (SELECT id FROM public.schools WHERE code = 'EQS-DEMO' LIMIT 1) WHERE school_id IS NULL;
UPDATE public.notifications SET school_id = (SELECT id FROM public.schools WHERE code = 'EQS-DEMO' LIMIT 1) WHERE school_id IS NULL;

-- ---------------------------------------------------------------------------
-- 8. Promote admin@eduquest.zm to SUPER_USER (unaffiliated — can switch schools)
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET role = 'SUPER_USER', school_id = NULL  -- super user is platform-wide, not school-bound
WHERE email = 'admin@eduquest.zm';

-- ---------------------------------------------------------------------------
-- 9. Create teacher_class_assignments for existing classes
-- ---------------------------------------------------------------------------
INSERT INTO public.teacher_class_assignments (teacher_id, class_id, school_id)
SELECT c.teacher_id, c.id, c.school_id FROM public.classes c
ON CONFLICT (teacher_id, class_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. RLS helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID AS $$
DECLARE s UUID;
BEGIN
  SELECT school_id INTO s FROM public.profiles WHERE id = auth.uid();
  RETURN s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_role() = 'SUPER_USER';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_role() = 'SCHOOL_ADMIN' AND public.current_school_id() = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = p_class_id AND c.teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.teacher_class_assignments tca
    WHERE tca.teacher_id = auth.uid() AND tca.class_id = p_class_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 11. RLS POLICY UPDATES — drop & recreate with school-scoped checks
-- ---------------------------------------------------------------------------

-- SCHOOLS RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schools_select_visible ON public.schools;
CREATE POLICY schools_select_visible ON public.schools
  FOR SELECT USING (
    public.is_super_user()
    OR id = public.current_school_id()
  );
DROP POLICY IF EXISTS schools_super_user_write ON public.schools;
CREATE POLICY schools_super_user_write ON public.schools
  FOR ALL USING (public.is_super_user())
  WITH CHECK (public.is_super_user());

-- PROFILES RLS — school-scoped for SCHOOL_ADMIN
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT USING (
    public.is_super_user()
    OR id = auth.uid()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR (public.current_role() = 'TEACHER' AND school_id = public.current_school_id()
        AND EXISTS (
          SELECT 1 FROM public.class_members cm
          JOIN public.classes c ON c.id = cm.class_id
          WHERE c.teacher_id = auth.uid() AND cm.learner_id = public.profiles.id
        ))
  );

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
  );

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
  );

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
  );

-- CLASSES RLS — school-scoped
DROP POLICY IF EXISTS classes_select_visible ON public.classes;
CREATE POLICY classes_select_visible ON public.classes
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
    OR public.is_class_member(id)
  );
DROP POLICY IF EXISTS classes_teacher_or_admin_write ON public.classes;
CREATE POLICY classes_teacher_or_admin_write ON public.classes
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
  );

-- CLASS_MEMBERS RLS — school-scoped
DROP POLICY IF EXISTS class_members_select_visible ON public.class_members;
CREATE POLICY class_members_select_visible ON public.class_members
  FOR SELECT USING (
    public.is_super_user()
    OR learner_id = auth.uid()
    OR public.is_teacher_of_class(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND c.school_id = public.current_school_id()
        AND public.current_role() = 'SCHOOL_ADMIN'
    )
  );
DROP POLICY IF EXISTS class_members_teacher_or_admin_write ON public.class_members;
CREATE POLICY class_members_teacher_or_admin_write ON public.class_members
  FOR ALL USING (
    public.is_super_user()
    OR public.is_teacher_of_class(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND c.school_id = public.current_school_id()
        AND public.current_role() = 'SCHOOL_ADMIN'
    )
  )
  WITH CHECK (
    public.is_super_user()
    OR public.is_teacher_of_class(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND c.school_id = public.current_school_id()
        AND public.current_role() = 'SCHOOL_ADMIN'
    )
  );

-- LESSONS RLS — school-scoped
DROP POLICY IF EXISTS lessons_select_visible ON public.lessons;
CREATE POLICY lessons_select_visible ON public.lessons
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
    OR (status = 'PUBLISHED' AND public.is_lesson_assigned_to_me(id))
  );
DROP POLICY IF EXISTS lessons_teacher_or_admin_write ON public.lessons;
CREATE POLICY lessons_teacher_or_admin_write ON public.lessons
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
  );

-- QUIZZES RLS — school-scoped
DROP POLICY IF EXISTS quizzes_select_visible ON public.quizzes;
CREATE POLICY quizzes_select_visible ON public.quizzes
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
    OR (status = 'PUBLISHED' AND public.is_quiz_assigned_to_me(id))
  );
DROP POLICY IF EXISTS quizzes_teacher_or_admin_write ON public.quizzes;
CREATE POLICY quizzes_teacher_or_admin_write ON public.quizzes
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
  );

-- QUIZ_QUESTIONS, QUIZ_ASSIGNMENTS, QUIZ_ATTEMPTS, QUIZ_ANSWERS — keep existing
-- policies (they delegate via quiz_id which is now school-scoped upstream).

-- QUESTION_BANK RLS — school-scoped
DROP POLICY IF EXISTS question_bank_select_visible ON public.question_bank;
CREATE POLICY question_bank_select_visible ON public.question_bank
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_role() IN ('SCHOOL_ADMIN', 'TEACHER') AND school_id = public.current_school_id())
  );
DROP POLICY IF EXISTS question_bank_teacher_or_admin_write ON public.question_bank;
CREATE POLICY question_bank_teacher_or_admin_write ON public.question_bank
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR (public.current_role() = 'TEACHER' AND school_id = public.current_school_id() AND created_by_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR (public.current_role() = 'TEACHER' AND school_id = public.current_school_id())
  );

-- NOTIFICATIONS RLS — own only (no change in semantics; just school_id added)
-- (existing policy already uses user_id = auth.uid() — keep it)

-- LESSON_ASSIGNMENTS, LESSON_PROGRESS — keep existing (they delegate via lesson_id)

-- ---------------------------------------------------------------------------
-- 12. LIBRARY_RESOURCES RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.library_resources ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated in a school can see their school's resources + global resources.
-- Super user sees all.
DROP POLICY IF EXISTS library_resources_select_visible ON public.library_resources;
CREATE POLICY library_resources_select_visible ON public.library_resources
  FOR SELECT USING (
    public.is_super_user()
    OR (auth.uid() IS NOT NULL AND (school_id = public.current_school_id() OR school_id IS NULL) AND status = 'PUBLISHED')
    OR (public.current_role() IN ('SCHOOL_ADMIN', 'TEACHER') AND school_id = public.current_school_id())
  );

-- Super user: write anywhere. School admin: write in own school. Teacher: write in own school.
DROP POLICY IF EXISTS library_resources_write ON public.library_resources;
CREATE POLICY library_resources_write ON public.library_resources
  FOR INSERT WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR (public.current_role() = 'TEACHER' AND school_id = public.current_school_id() AND uploaded_by_id = auth.uid())
  );

DROP POLICY IF EXISTS library_resources_update ON public.library_resources;
CREATE POLICY library_resources_update ON public.library_resources
  FOR UPDATE USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR (public.current_role() = 'TEACHER' AND school_id = public.current_school_id() AND uploaded_by_id = auth.uid())
  );

DROP POLICY IF EXISTS library_resources_delete ON public.library_resources;
CREATE POLICY library_resources_delete ON public.library_resources
  FOR DELETE USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR (public.current_role() = 'TEACHER' AND school_id = public.current_school_id() AND uploaded_by_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 13. TEACHER_CLASS_ASSIGNMENTS RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_class_assignments_select_visible ON public.teacher_class_assignments;
CREATE POLICY teacher_class_assignments_select_visible ON public.teacher_class_assignments
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
    OR teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS teacher_class_assignments_super_or_school_admin_write ON public.teacher_class_assignments;
CREATE POLICY teacher_class_assignments_super_or_school_admin_write ON public.teacher_class_assignments
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND school_id = public.current_school_id())
  );

-- ---------------------------------------------------------------------------
-- 14. Add new tables to the realtime publication
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('schools', 'library_resources', 'teacher_class_assignments')
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 15. Verify
-- ---------------------------------------------------------------------------
SELECT 'Migration complete.' AS status,
       (SELECT COUNT(*) FROM public.schools) AS schools_count,
       (SELECT COUNT(*) FROM public.profiles WHERE role = 'SUPER_USER') AS super_users_count,
       (SELECT COUNT(*) FROM public.library_resources) AS library_resources_count,
       (SELECT COUNT(*) FROM public.teacher_class_assignments) AS teacher_class_assignments_count;
