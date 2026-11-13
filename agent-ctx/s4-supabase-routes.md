# Task s4 — Supabase API routes migration

## Status
COMPLETED

## Approach
Rewrote all 37 API routes from Prisma to Supabase. Using `supabaseService()` for all routes (per instructions — simpler, role/ownership checked manually with `requireUser`).

## Key conventions
- All routes use `requireUser(roles?)` from `@/lib/api-helpers` for auth + role check.
- All routes use `supabaseService()` (bypasses RLS) — defense-in-depth RLS is in DB.
- JSONB columns accept native JS values directly (no `JSON.stringify`).
- `_count` keys preserved to match frontend expectations: `{ members, lessonAssignments, quizAssignments }` for classes, `{ questions, assignments, attempts }` for quizzes.
- snake_case → camelCase conversion done inline in formatters.
- `notify()` → `notifySupabase()` from `@/lib/notify-supabase`.

## Routes rewritten (36 files) + 1 deleted placeholder = 37 total
- src/app/api/route.ts — DELETED (was a placeholder, replaced by Next.js root layout)
- src/app/api/subjects/route.ts
- src/app/api/users/route.ts
- src/app/api/users/[id]/route.ts
- src/app/api/classes/route.ts
- src/app/api/classes/[id]/route.ts
- src/app/api/classes/[id]/members/route.ts
- src/app/api/classes/[id]/members/[userId]/route.ts
- src/app/api/classes/join/route.ts
- src/app/api/lessons/route.ts
- src/app/api/lessons/[id]/route.ts
- src/app/api/lessons/[id]/duplicate/route.ts
- src/app/api/lessons/[id]/assign/route.ts
- src/app/api/lessons/[id]/mark-complete/route.ts
- src/app/api/quizzes/route.ts
- src/app/api/quizzes/[id]/route.ts
- src/app/api/quizzes/[id]/assign/route.ts
- src/app/api/quizzes/[id]/results/route.ts
- src/app/api/quizzes/[id]/start/route.ts
- src/app/api/quizzes/[id]/submit/route.ts
- src/app/api/quizzes/attempts/[attemptId]/route.ts
- src/app/api/question-bank/route.ts
- src/app/api/question-bank/[id]/route.ts
- src/app/api/ai/generate-quiz/route.ts
- src/app/api/ai/generate-lesson/route.ts
- src/app/api/ai/mark-short-answer/route.ts
- src/app/api/analytics/admin/route.ts
- src/app/api/analytics/teacher/route.ts
- src/app/api/analytics/learner/route.ts
- src/app/api/analytics/quiz/[id]/route.ts
- src/app/api/analytics/quiz/[id]/export/route.ts
- src/app/api/analytics/public/route.ts
- src/app/api/notifications/route.ts
- src/app/api/notifications/[id]/read/route.ts
- src/app/api/notifications/read-all/route.ts
- src/app/api/quiz-attempts/[attemptId]/answers/[answerId]/route.ts

## Verification
- `bun run lint` → 0 errors, 1 pre-existing warning unrelated to this work (React Hook Form `watch()` API in `teacher-classes-view.tsx`).
- All 36 routes compile successfully when triggered via curl (no TypeScript / Turbopack compile errors).
- HTTP status codes observed: 401 (no session, auth required), 405 (wrong method), 500 (Supabase env vars not set, expected in sandbox).
- No runtime compile errors in dev.log.

## Notes / decisions
- Used `supabaseService()` everywhere with manual role/ownership checks (per instructions).
- For the `classes` list/detail, wrote a local `formatClassRow` to keep `_count.lessonAssignments`/`quizAssignments` keys matching what the frontend uses.
- For `quizzes`, kept `_count.questions/assignments/attempts` keys.
- For lessons, kept `_count.assignments/progress` keys.
- Learner progress on `GET /api/lessons/[id]` is returned as `myProgress` (matches Prisma shape).
- `start` route's question randomization re-shuffles the options and re-derives the correct letter — preserved exactly from the Prisma version (the saved attempt doesn't store the shuffled questions, but `random_question_order`/`random_answer_order` flags affect only what's shown to the learner; marking uses the original DB rows).
- `submit` route re-reads questions from DB, marks each answer (objective deterministic; short answer via AI), saves to `quiz_answers`, then updates the attempt totals.
- `quiz-attempts/[attemptId]/answers/[answerId]` PATCH route recomputes attempt totals after each teacher override.
- For analytics routes, used Promise.all + head:true counts to mirror the Prisma parallel `db.X.count()` calls.
- `notifications/[id]/read` and `notifications/read-all` use `.eq('user_id', user.id)` to enforce ownership at the SQL level (RLS would also gate this; we use the service client so the explicit filter is required).

