# Task m7-m10 — Multi-school RBAC frontend

**Task ID**: `m7-m10`
**Agent**: Claude (frontend)
**Scope**: Build the frontend UI for the new SUPER_USER / SCHOOL_ADMIN roles + the new Library module so the multi-school RBAC works end-to-end.

## What was built

### Files created (10 new)

1. `src/components/views/super/super-dashboard-view.tsx` — Super user dashboard: 8 stat cards (schools, users, teachers, learners, classes, lessons, quizzes, library), schools overview table (with code badges, click → super.schools?schoolId=), per-grade bar chart, 4-role pie chart, live recent activity feed, quick actions.
2. `src/components/views/super/super-schools-view.tsx` — School management: search + status filter, grid of school cards (name, code, address, phone, email, status, counts, created_at), Add/Edit dialog (name, code, address, phone, email), disable/enable toggle, delete with AlertDialog. Uses `useRealtimeQuery` table=`schools`.
3. `src/components/views/super/super-users-view.tsx` — Cross-school user management: search + role filter + school filter, table with school column ("Platform-wide" badge for SUPER_USER), Add/Edit dialog with role + school select (school disabled for SUPER_USER), bulk import modal with CSV textarea, template download, per-row results table.
4. `src/components/views/shared/library-view.tsx` — Shared Library component, accepts `scope: 'super' | 'school-admin' | 'teacher' | 'learner'`. Filter bar (search, grade, subject, paper type), grid of resource cards with color-coded paper_type badges, file type icon, download button, edit/delete for non-learners, Add Resource dialog with optional school-scope select for SUPER_USER. Realtime via `library_resources`.
5. `src/components/views/school-admin/school-admin-dashboard-view.tsx` — School admin dashboard: 5 stat cards, learners per grade bar chart, recent activity feed, quick actions (Add Teacher / Add Learner / Create Class / Bulk Import).
6. `src/components/views/school-admin/school-admin-teachers-view.tsx` — Teacher management: table, Add/Edit dialog, assign-classes dialog (checkboxes of all classes in school → POST/DELETE `/api/teacher-class-assignments`), edit/disable/delete.
7. `src/components/views/school-admin/school-admin-classes-view.tsx` — Read + Create class cards (mirrors teacher-classes-view but for whole-school scope).
8. `src/components/views/school-admin/school-admin-learners-view.tsx` — Learner management: search + grade filter, Add/Edit dialog (with class_code), bulk import modal (schoolId auto-set to user's school).
9. `src/components/views/school-admin/school-admin-settings-view.tsx` — School settings form (name, address, phone, email). Code is read-only. PATCH `/api/schools/[id]`.

### Files updated (6)

1. `src/components/sidebar.tsx` — Extended role type to `'SUPER_USER' | 'SCHOOL_ADMIN' | 'TEACHER' | 'LEARNER' | 'ADMIN'`. Added nav items for SUPER_USER (Dashboard, Schools, Users, Library, Settings) and SCHOOL_ADMIN (Dashboard, Teachers, Classes, Learners, Library, Settings). Added Library → `teacher.library` and `learner.library` for the existing roles. Legacy ADMIN falls back to SCHOOL_ADMIN nav.
2. `src/components/view-renderer.tsx` — Wired the new view names (`super.*`, `school-admin.*`, `teacher.library`, `learner.library`). Legacy `admin.dashboard`/`admin.users`/`admin.settings` route to the new role-aware components when the user is SUPER_USER or SCHOOL_ADMIN.
3. `src/components/app-shell.tsx` — Header now shows a school scope badge ("Platform-wide" for SUPER_USER, school name for others). Added "Switch school" dropdown item for SUPER_USER that opens a dialog listing schools; clicking one navigates to `super.schools?schoolId=...`. The Settings menu item now routes per-role.
4. `src/components/views/login-view.tsx` — Updated demo accounts: replaced "Administrator" with "Super User" (admin@eduquest.zm) and added "School Admin · Headmaster" (headmaster@eduquest.zm).
5. `src/app/api/users/[id]/route.ts` — Backend (minimal): GET/PATCH now allow SUPER_USER and SCHOOL_ADMIN (school-scoped) and self; DELETE allows SUPER_USER and SCHOOL_ADMIN (own school only).
6. `src/app/api/schools/[id]/route.ts` — Backend (minimal): PATCH now allows SCHOOL_ADMIN to update their own school (cannot change code).
7. `src/app/api/classes/route.ts` — Backend (minimal): POST now also allows SUPER_USER and SCHOOL_ADMIN (in addition to TEACHER/ADMIN).

### What was NOT changed (and why)

- `src/hooks/use-current-user.ts` — Already had `schoolId`, `schoolName`, `schoolCode`. No change needed.
- `src/lib/router.tsx` — View names are strings, no typing extension needed. No change.
- `src/components/views/admin/admin-dashboard.tsx` — Kept as-is for the legacy `ADMIN` fallback. The ViewRenderer now routes new role-aware dashboards to the new components when the user is SUPER_USER or SCHOOL_ADMIN.

## Verification

### Lint
`bun run lint` → **0 errors**, 2 warnings. Both warnings are `react-hooks/incompatible-library` for `form.watch('grade')` inside a Select — the same pattern already exists in `src/components/views/teacher/teacher-classes-view.tsx` and is a known React Hook Form + React Compiler limitation, not a real bug.

### Compile (dev.log)
Latest entries:
```
✓ Compiled in 121ms
GET / 200 in 372ms (compile: 37ms, proxy.ts: 5ms, render: 331ms)
GET /api/auth/me 200 in 17ms
```
No "Module not found" / "Error" / TS errors in the latest tail. (Stale module-not-found lines earlier in `dev.log` were from when intermediate file states were being written while Turbopack hot-reloaded; the final state compiles cleanly.)

### End-to-end notes
- The patch route changes (`/api/users/[id]`, `/api/schools/[id]`, `/api/classes` POST) are small backward-compatible additions that allow the new roles to perform the actions the UI surfaces. The original `ADMIN` (legacy) behaviour is preserved.
- I did NOT add a "Bulk Import" entry point on the super dashboard — the bulk-import modal is available from the Super Users view (`super.users`) and the School Admin Learners view (`school-admin.learners`). The school-admin dashboard's "Bulk Import" quick action navigates to `school-admin.learners?bulk=1`, which auto-opens the modal.
- "Switch school" in the AppShell dropdown simply navigates the super user to `super.schools` for that school (no actual session switching — that would require a separate mechanism the backend doesn't expose).

## File count
- 9 new view files
- 6 modified files (sidebar, view-renderer, app-shell, login-view, 3 API routes)
- 1 work record (this file)
