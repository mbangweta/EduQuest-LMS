# EduQuest LMS — Supabase Setup Guide

This guide connects the EduQuest LMS to your Supabase project. Follow these 5 steps in order. The whole setup takes about 5 minutes.

---

## Step 1 — Copy the env template

```bash
cp .env.example .env
```

## Step 2 — Paste your Supabase credentials

Open `.env` and replace the four placeholder values with your project's real keys.

Go to **[supabase.com](https://supabase.com) → your project → Settings → API** and copy:

| Env var in `.env`                     | Where to find it in Supabase        |
|---------------------------------------|-------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`            | Project URL (top of the API page)   |
| `SUPABASE_URL`                        | Same as above (yes, paste it twice) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | "Project API keys" → `anon` `public`|
| `SUPABASE_SERVICE_ROLE_KEY`          | "Project API keys" → `service_role` (**keep secret — never expose in the browser**)|

Your `.env` should look like:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...service_role_key...
DATABASE_URL=file:/home/z/my-project/db/custom.db   # legacy fallback — leave it
```

## Step 3 — Apply the database schema + RLS policies

Open the Supabase Dashboard → **SQL Editor → New query**.

Paste the entire contents of [`db/supabase-schema.sql`](db/supabase-schema.sql) into the editor and click **Run**.

This creates:
- All 14 tables (`profiles`, `subjects`, `classes`, `class_members`, `lessons`, `lesson_assignments`, `lesson_progress`, `quizzes`, `quiz_questions`, `quiz_assignments`, `quiz_attempts`, `quiz_answers`, `question_bank`, `notifications`)
- Native Postgres enums for `user_role`, `quiz_status`, `question_type`, etc.
- Indexes for fast queries
- A trigger that auto-creates a `profiles` row whenever a new auth user signs up
- **Row Level Security policies** for every table, including:
  - Teachers can only read/update their own classes, lessons, quizzes
  - Learners only see classes/lessons/quizzes assigned to them
  - Learners never see answer keys (RLS + API-level stripping)
  - Users can only read their own notifications
- A `lesson-attachments` storage bucket with policies for teacher uploads

You can re-run this script safely — it uses `IF NOT EXISTS` and `ON CONFLICT` everywhere.

## Step 4 — Seed the database with Zambian sample data

From your terminal:

```bash
bun run db:seed-supabase
```

This uses your `SUPABASE_SERVICE_ROLE_KEY` to create:
- 12 subjects (Mathematics, Integrated Science, English, Special Paper 1, etc.)
- 9 users via Supabase Auth (1 admin, 2 teachers, 6 learners — all with password `eduquest123`)
- 3 classes (Grade 7 Purple Mathematics, Grade 6 Science, Grade 5 Special Paper 1)
- 4 lessons (3 published + 1 draft, all with full Zambian-context content)
- 3 quizzes with 4–5 questions each (across all 6 question types)
- 2 quiz assignments + lesson assignments
- 3 quiz attempts with auto-marked answers (showing real scores: 91.7%, 66.7%, 60%)
- 8 notifications

To re-seed later (wipe + recreate), call the admin-only endpoint:
```bash
# After logging in as admin:
curl -X POST "http://localhost:3000/api/seed-supabase?force=1"
```

## Step 5 — Restart the dev server

```bash
# Stop the running dev server (Ctrl+C), then:
bun run dev
```

Open the app. You should see the landing page with live stats from your Supabase project (counts will be the seeded numbers: 6 learners, 2 teachers, 3 classes, 12 subjects, etc.). Click **Sign in**, use any demo account (e.g. `admin@eduquest.zm` / `eduquest123`), and you'll land on the dashboard.

---

## Demo accounts (all passwords: `eduquest123`)

| Role      | Email                     | Notes                              |
|-----------|---------------------------|------------------------------------|
| Admin     | `admin@eduquest.zm`       | Sees all users, classes, settings  |
| Teacher   | `mrs.siya@eduquest.zm`    | Owns Grade 7 Math + Grade 5 SP1     |
| Teacher   | `mr.chisango@eduquest.zm`  | Owns Grade 6 Science               |
| Learner G7| `thabo@eduquest.zm`       | Enrolled in Grade 7 Math            |
| Learner G7| `chipo@eduquest.zm`       | Enrolled in Grade 7 Math            |
| Learner G6| `lubosi@eduquest.zm`      | Enrolled in Grade 6 Science         |
| Learner G5| `natasha@eduquest.zm`     | Enrolled in Grade 5 SP1             |
| Learner G8| `kabwe@eduquest.zm`       | Enrolled in Grade 6 Science         |
| Learner G9| `mutale@eduquest.zm`      | Enrolled in Grade 5 SP1             |

---

## Architecture

```
Browser ─── Supabase Auth (cookie JWT) ─── Next.js API routes
                                              │
                                              ├── supabaseServer()  → RLS-respecting client (bound to user session)
                                              └── supabaseService() → service_role client (bypasses RLS, server-only)
                                                                       used for admin ops, AI marking, answer-key reads
                                                                       (with API-level stripping before sending to learner)
```

**Why two clients?** The `service_role` key bypasses RLS, which is needed for:
- Admin operations across all users/classes
- AI-assisted short answer marking (the marking guide is hidden from learners)
- Reading answer keys server-side, then stripping them before sending to the learner
- Seeding the database

All other operations use the user-bound `supabaseServer()` client, which enforces RLS automatically.

**Defense in depth:** Even if a learner somehow bypassed RLS, the API routes also strip answer-key fields (`correct_answer`, `accepted_answers`, `matching_pairs`, `marking_guide`) from every question before sending it to a learner. Learners literally cannot see the answers until after they submit.

---

## File map (key new files)

| File                                                | Purpose                                            |
|-----------------------------------------------------|----------------------------------------------------|
| `db/supabase-schema.sql`                            | Full schema + RLS policies (run in Supabase SQL editor) |
| `.env.example`                                      | Template for env vars                              |
| `src/lib/supabase.ts`                              | Server clients (service + session-bound) — server-only |
| `src/lib/supabase-browser.ts`                      | Browser anon client (safe for client components)   |
| `src/lib/auth-supabase.ts`                         | `getCurrentUser`, `requireRole`, admin user CRUD   |
| `src/lib/api-helpers.ts`                           | Shared helpers (requireUser, formatQuestion, etc.) |
| `src/lib/notify-supabase.ts`                       | Notification helper                                 |
| `src/lib/seed-supabase.ts`                         | Seed script — run via `bun run db:seed-supabase`   |
| `src/middleware.ts`                                 | Refreshes Supabase session cookie on every request |
| `src/app/api/auth/me/route.ts`                     | Returns current user's role-enriched profile       |
| `src/app/api/auth/signout/route.ts`                | Clears session cookie                              |
| `src/app/api/auth/signup/route.ts`                 | Learner self-signup                                |
| `src/app/api/seed-supabase/route.ts`               | Re-seed endpoint (admin-only)                      |
| `src/app/api/**/route.ts` (37 routes)              | All rewritten from Prisma to supabase-js           |

## What changed from the Prisma version

- **Database:** Prisma/SQLite → Supabase Postgres (14 tables, same shape, snake_case columns, native enums)
- **Auth:** NextAuth Credentials (bcrypt) → Supabase Auth (PBKDF2, password reset built in)
- **Security:** App-level role checks → App-level role checks **+ Postgres Row Level Security** (defense in depth)
- **Sessions:** NextAuth JWT cookie → Supabase Auth cookie (refreshed by middleware)
- **JSON columns:** `String` + manual `JSON.parse`/`stringify` → Postgres `JSONB` (auto-parsed by supabase-js)
- **Storage:** Local file URLs → Supabase Storage bucket `lesson-attachments` (with teacher-scoped RLS policies)
- **Seed:** `bun run db:seed` (Prisma) → `bun run db:seed-supabase` (Supabase)

## Rolling back

If you want to go back to Prisma/SQLite for any reason:
1. Remove the Supabase env vars from `.env`
2. The app automatically falls back to the local SQLite database
3. The public landing page reads from whichever DB is configured

The Prisma schema (`prisma/schema.prisma`) and seed (`src/lib/seed.ts`) are still in the repo, so the local mode keeps working.

---

## Troubleshooting

**"SUPABASE_SERVICE_ROLE_KEY is not set"**
→ You forgot to fill in the service role key in `.env`. Re-check Step 2.

**"Invalid API key" when running `bun run db:seed-supabase`**
→ The service role key is wrong. Make sure you copied the `service_role` key, not the `anon` key.

**Login fails with "Invalid login credentials"**
→ You haven't run the seed yet (Step 4). Run `bun run db:seed-supabase`.

**Public landing page shows 0 users / 0 classes**
→ The `/api/analytics/public` endpoint reads from Supabase. If Supabase is configured but empty, run the seed. If Supabase isn't configured, it falls back to local SQLite.

**Learner can see answer keys before submitting**
→ This should never happen. The API strips answer keys from every question sent to a learner. If you see this, the RLS policies aren't applied — re-run `db/supabase-schema.sql`.

---

You're ready. Welcome to EduQuest LMS on Supabase.
