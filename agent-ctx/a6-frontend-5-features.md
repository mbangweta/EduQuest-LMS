# Task a6 — EduQuest LMS Frontend 5+1 Features (Work Record)

## Task ID: a6
## Agent: frontend-builder
## Project: /home/z/my-project (Next.js 16 + TypeScript + App Router)

## Scope

Built 6 frontend features on top of the already-completed backend
(SQL migration + API routes). All UI is wired into the existing
EduQuest LMS SPA shell (hash router + sidebar + role-aware views).

## Files Created (7)

1. `src/hooks/use-academic-year.ts` — Academic Year switcher hook.
   - Uses TanStack Query's `useQuery` for fetch + loading state.
   - Persists selected year id to `localStorage` under
     `eduquest-academic-year`.
   - Broadcasts changes via a custom `eduquest-academic-year-change`
     event so multiple hook instances (switcher + consumers) sync.
   - Falls back to the `is_current` year, then the first year.
   - Disabled for SUPER_USER (no schoolId).

2. `src/components/views/shared/academic-years-view.tsx` — shared
   Academic Years CRUD view (used by both super and school-admin
   scopes via the `scope` prop).
   - Table with name, school (super only), start/end dates, status
     badge (Active green / Closed gray / Draft), Current badge +
     "Set as current" action.
   - Add / Edit dialog with name, dates, status, isCurrent, and
     schoolId picker (super only).
   - Delete via AlertDialog (ConfirmDialog).
   - `useRealtimeQuery` with table=`academic_years`.

3. `src/components/views/shared/change-password-dialog.tsx` —
   Change-password dialog used by the user dropdown menu.
   - Current + New + Confirm password inputs (with show/hide toggles).
   - Validates new password ≥ 6 chars and password match.
   - POST `/api/auth/change-password`. Toasts "Password changed" /
     error.

4. `src/components/views/shared/reset-password-dialog.tsx` —
   Reset-password dialog used by the user-edit dialogs.
   - New + Confirm password inputs (show/hide toggles).
   - PATCHes `/api/users/[id]` with `{ password }`.
   - Toasts `Password reset for {name}` on success.

5. `src/components/views/shared/bulk-excel-upload-dialog.tsx` —
   Reusable Excel/CSV bulk-import dialog used by the three user
   views (super users, school-admin learners, school-admin teachers).
   - File picker + drag & drop zone, accepts `.xlsx`, `.xls`, `.csv`.
   - Posts `multipart/form-data` with the file + optional `schoolId`
     (super) + `defaultPassword` to `/api/users/bulk-import-excel`
     via raw `fetch` (api-client only does JSON).
   - Shows progress indicator + results table (row, email, OK/Fail,
     error).
   - "Download template" link generates a sample CSV.

6. `src/components/views/school-admin/school-admin-promote-view.tsx`
   — Promote Learners view.
   - Options: From grade (5-12 or All), Max grade (default 12, learners
     at/above graduate), Dry run toggle (default ON).
   - "Preview" calls `POST /api/learners/promote` with dryRun=true.
   - Three result tables: promoted, graduated, skipped. Counts in
     stat blocks at the top. Framer Motion animates each row in.
   - "Promote Now" opens a confirm dialog then runs with dryRun=false.
     Toasts `Promoted N learners`.

7. `src/components/views/school-admin/school-admin-teacher-workload-view.tsx`
   — Teacher Workload view.
   - Lists all teachers in the school.
   - For each: shows teacher (avatar + name), classes (as BookOpen
     badges with grade), subjects (as colored badges with the
     subject color), Edit button.
   - Edit dialog: two multi-select columns (Classes + Subjects) with
     checkboxes pre-populated from current assignments.
   - Save diffs against the initial set: POST adds, DELETE removes
     for each added/removed class/subject. Toasts the change count.
   - `useRealtimeQuery` for both `teacher_class_assignments` and
     `teacher_subject_assignments`.

## Files Updated (5)

8. `src/components/sidebar.tsx`
   - Added SUPER_USER item: "Academic Years" → `super.academic-years`
     (CalendarDays icon, between Library and Settings).
   - Added SCHOOL_ADMIN items:
     - "Academic Years" → `school-admin.academic-years` (between
       Library and Settings).
     - "Promote Learners" → `school-admin.promote` (between Learners
       and Library).
     - "Teacher Workload" → `school-admin.teacher-workload` (between
       Teachers and Classes).

9. `src/components/view-renderer.tsx`
   - Imported `AcademicYearsView`, `SchoolAdminPromoteView`,
     `SchoolAdminTeacherWorkloadView`.
   - Wired:
     - `super.academic-years` → `<AcademicYearsView scope="super" />`
     - `school-admin.academic-years` → `<AcademicYearsView scope="school-admin" />`
     - `school-admin.promote` → `<SchoolAdminPromoteView />`
     - `school-admin.teacher-workload` → `<SchoolAdminTeacherWorkloadView />`

10. `src/components/app-shell.tsx`
    - Added Academic Year switcher dropdown next to the school badge
      in the header (visible to school-scoped roles: SCHOOL_ADMIN,
      TEACHER, LEARNER). Label: "AY: {name}" with CalendarDays icon.
      Persists selection via the `useAcademicYear` hook.
    - Added "Change password" item to the user dropdown menu — opens
      `ChangePasswordDialog`.

11. `src/components/views/super/super-users-view.tsx`
    - Replaced the CSV textarea Bulk Import dialog with
      `<BulkExcelUploadDialog>` (file picker).
    - Added a "Reset Password" section in the Edit User dialog (with
      button → `<ResetPasswordDialog>`).

12. `src/components/views/school-admin/school-admin-learners-view.tsx`
    - Replaced the CSV textarea Bulk Import dialog with
      `<BulkExcelUploadDialog>`.
    - Added a "Reset Password" section in the Edit Learner dialog.

13. `src/components/views/school-admin/school-admin-teachers-view.tsx`
    - Added "Bulk Import" button next to "Add Teacher" (opens
      `<BulkExcelUploadDialog>`).
    - Added a "Reset Password" section in the Edit Teacher dialog.

## Verification

### Lint

`bun run lint` final result:

```
✖ 3 problems (0 errors, 3 warnings)
```

All 3 warnings are pre-existing react-hook-form `form.watch('grade')`
patterns (Compilation Skipped: incompatible-library) and are NOT
introduced by this task. The file `school-admin-learners-view.tsx`
warning at line 302 was already there before — I only edited the
import lines and the dialog bodies, not the grade `<Select>` row.

### Dev log

`tail -50 /home/z/my-project/dev.log` shows the dev server is
running cleanly on port 3000. Many `✓ Compiled in ...ms` lines,
no `Failed to compile`, no `Type error`, no `Module not found` and
no `SyntaxError` after the new files were picked up. The only
informational message is the pre-existing Supabase env warning
(`NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not
set`), which is unrelated to my work and was present before this
task started.

## Files created/updated count

- Created: 7 files
- Updated: 5 files
- Total touched: 12 files

## Endpoints used (all backend already done)

- `GET/POST /api/academic-years` — list + create
- `PATCH/DELETE /api/academic-years/[id]` — edit + delete + set current
- `POST /api/learners/promote` — bulk promote / dry-run / graduate
- `GET/POST/DELETE /api/teacher-subject-assignments` — list + assign + unassign
- `GET/POST/DELETE /api/teacher-class-assignments` — already used by teachers view; reused here
- `POST /api/auth/change-password` — change own password (verifies current)
- `POST /api/users/bulk-import-excel` — multipart upload (xlsx/xls/csv)
- `PATCH /api/users/[id]` with `{ password }` — reset password

## Notes for next agent

- The `useAcademicYear` hook exposes `currentYearId` and
  `currentYearName`. Other views can read these to scope their
  queries to the selected academic year if/when they support
  per-year data (currently no views use this — but the hook is in
  place).
- The `BulkExcelUploadDialog` is generic: pass `allowSchoolSelect`
  for super user (shows a school dropdown), omit for school-admin
  (uses the admin's own school by RLS).
- The `ResetPasswordDialog` and `ChangePasswordDialog` are both
  reusable and self-contained (they reset state on close).
