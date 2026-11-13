-- ============================================================================
-- EduQuest LMS — Academic Years + Teacher Workload Migration
-- ============================================================================
-- Idempotent — safe to re-run. Run as a single block in Supabase SQL Editor.
--
-- Adds:
--   1. academic_years table (per-school year, e.g. "2025")
--   2. academic_year_id column on classes + class_members
--   3. teacher_subject_assignments table (multi-subject teacher workload)
--   4. Default academic year 2025 for each existing school
--   5. RLS policies for new tables
--   6. Realtime publication for new tables
-- ============================================================================

-- 1. academic_years table
CREATE TABLE IF NOT EXISTS public.academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                       -- e.g. "2025" or "2025/2026"
  start_date  DATE,
  end_date    DATE,
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',      -- ACTIVE | CLOSED
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);
DROP TRIGGER IF EXISTS academic_years_updated_at ON public.academic_years;
CREATE TRIGGER academic_years_updated_at BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS academic_years_school_id_idx ON public.academic_years(school_id);
CREATE INDEX IF NOT EXISTS academic_years_status_idx ON public.academic_years(status);

-- 2. teacher_subject_assignments table
CREATE TABLE IF NOT EXISTS public.teacher_subject_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_id         UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id  UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, subject_id, school_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS teacher_subject_assignments_teacher_id_idx ON public.teacher_subject_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS teacher_subject_assignments_subject_id_idx ON public.teacher_subject_assignments(subject_id);
CREATE INDEX IF NOT EXISTS teacher_subject_assignments_school_id_idx  ON public.teacher_subject_assignments(school_id);

-- 3. Add academic_year_id to classes + class_members (nullable for backward compat)
ALTER TABLE public.classes        ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.class_members  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS classes_academic_year_id_idx       ON public.classes(academic_year_id);
CREATE INDEX IF NOT EXISTS class_members_academic_year_id_idx ON public.class_members(academic_year_id);

-- 4. Helper: get_or_create_current_academic_year(school_id) — returns the school's
-- current academic year, creating one named after the current calendar year if none.
CREATE OR REPLACE FUNCTION public.get_or_create_current_academic_year(p_school_id UUID)
RETURNS UUID AS $$
DECLARE y TEXT; ay_id UUID;
BEGIN
  y := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT id INTO ay_id FROM public.academic_years WHERE school_id = p_school_id AND name = y;
  IF ay_id IS NULL THEN
    INSERT INTO public.academic_years (school_id, name, start_date, end_date, is_current, status)
    VALUES (p_school_id, y, MAKE_DATE(y::INT, 1, 1), MAKE_DATE(y::INT, 12, 31), TRUE, 'ACTIVE')
    ON CONFLICT (school_id, name) DO NOTHING
    RETURNING id INTO ay_id;
  END IF;
  RETURN ay_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create default academic year 2025 for every existing school
DO $$
DECLARE s RECORD; ay_id UUID;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.get_or_create_current_academic_year(s.id);
  END LOOP;
END $$;

-- 6. Backfill academic_year_id on existing classes + class_members (use the school's current year)
UPDATE public.classes c
SET academic_year_id = (
  SELECT id FROM public.academic_years ay
  WHERE ay.school_id = c.school_id AND ay.is_current = TRUE
  LIMIT 1
)
WHERE c.academic_year_id IS NULL AND c.school_id IS NOT NULL;

UPDATE public.class_members cm
SET academic_year_id = (
  SELECT c.academic_year_id FROM public.classes c WHERE c.id = cm.class_id
)
WHERE cm.academic_year_id IS NULL;

-- 7. RLS for academic_years (school-scoped)
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS academic_years_select_visible ON public.academic_years;
CREATE POLICY academic_years_select_visible ON public.academic_years
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_school_id() = school_id AND auth.uid() IS NOT NULL)
  );
DROP POLICY IF EXISTS academic_years_super_or_school_admin_write ON public.academic_years;
CREATE POLICY academic_years_super_or_school_admin_write ON public.academic_years
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND public.current_school_id() = school_id)
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND public.current_school_id() = school_id)
  );

-- 8. RLS for teacher_subject_assignments (school-scoped)
ALTER TABLE public.teacher_subject_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_subject_assignments_select_visible ON public.teacher_subject_assignments;
CREATE POLICY teacher_subject_assignments_select_visible ON public.teacher_subject_assignments
  FOR SELECT USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND public.current_school_id() = school_id)
    OR teacher_id = auth.uid()
  );
DROP POLICY IF EXISTS teacher_subject_assignments_super_or_school_admin_write ON public.teacher_subject_assignments;
CREATE POLICY teacher_subject_assignments_super_or_school_admin_write ON public.teacher_subject_assignments
  FOR ALL USING (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND public.current_school_id() = school_id)
  )
  WITH CHECK (
    public.is_super_user()
    OR (public.current_role() = 'SCHOOL_ADMIN' AND public.current_school_id() = school_id)
  );

-- 9. Add new tables to realtime publication
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('academic_years', 'teacher_subject_assignments')
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 10. Verify
SELECT 'Migration complete.' AS status,
       (SELECT COUNT(*) FROM public.academic_years) AS academic_years_count,
       (SELECT COUNT(*) FROM public.classes WHERE academic_year_id IS NOT NULL) AS classes_with_year_count,
       (SELECT COUNT(*) FROM public.teacher_subject_assignments) AS teacher_subject_assignments_count;
