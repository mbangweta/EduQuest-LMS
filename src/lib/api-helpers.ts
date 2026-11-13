import { supabaseService, supabaseServer } from './supabase'
import { getCurrentUser, type CurrentUser, type Role } from './auth-supabase'
import { NextResponse } from 'next/server'

// ============================================================================
// API helpers shared by all routes
// ============================================================================

export { getCurrentUser, type CurrentUser, type Role }

// Auth + role check. Returns the user or throws a NextResponse 401/403.
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (roles && !roles.includes(user.role)) {
    throw new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

// Wrap an async route handler with try/catch → 500 JSON
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (e: any) {
      // If it's already a NextResponse (from requireUser), pass through
      if (e instanceof NextResponse) return e
      console.error('[api]', e)
      return NextResponse.json(
        { error: e?.message || 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

// Service client (bypasses RLS) — for admin ops, AI marking, answer-key reads
export { supabaseService, supabaseServer }

// JSON helpers for Postgres JSONB columns
export const J = (v: any) => (v === undefined ? null : JSON.stringify(v))
export const parseJson = (s: any, fallback: any = null) => {
  if (s == null) return fallback
  if (typeof s !== 'string') return s  // supabase-js auto-parses JSONB
  try { return JSON.parse(s) } catch { return fallback }
}

// ---------------------------------------------------------------------------
// Class code generator
// ---------------------------------------------------------------------------
export function generateClassCode(grade: number, subjectCode: string, year: number): string {
  const base = `G${grade}${subjectCode.toUpperCase().slice(0, 4)}-${year}`
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${base}-${suffix}`
}

// ---------------------------------------------------------------------------
// Strip answer key fields from a question before sending to a learner.
// Learners must never see: correct_answer, accepted_answers, matching_pairs,
// marking_guide. (numerical_tolerance is fine — it doesn't reveal the answer.)
// ---------------------------------------------------------------------------
export function stripAnswerKey(q: any) {
  return {
    id: q.id,
    type: q.type,
    questionText: q.question_text,
    options: q.options ?? undefined,
    markAllocation: q.mark_allocation ?? 1,
    order: q.order ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Convert a snake_case DB row to a camelCase API response for questions.
// Includes all fields (used by teacher/admin views).
// ---------------------------------------------------------------------------
export function formatQuestion(q: any) {
  return {
    id: q.id,
    type: q.type,
    questionText: q.question_text,
    options: q.options ?? undefined,
    correctAnswer: q.correct_answer ?? undefined,
    acceptedAnswers: q.accepted_answers ?? undefined,
    matchingPairs: q.matching_pairs ?? undefined,
    markingGuide: q.marking_guide ?? undefined,
    numericalTolerance: q.numerical_tolerance ?? undefined,
    markAllocation: q.mark_allocation ?? 1,
    explanation: q.explanation ?? undefined,
    order: q.order ?? 0,
    questionBankId: q.question_bank_id ?? undefined,
    createdAt: q.created_at,
  }
}

// ---------------------------------------------------------------------------
// Format a profile row for API responses (omits sensitive fields)
// ---------------------------------------------------------------------------
export function formatUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    grade: u.grade ?? null,
    phone: u.phone ?? null,
    status: u.status,
    avatarColor: u.avatar_color ?? null,
    createdAt: u.created_at,
  }
}

// ---------------------------------------------------------------------------
// Format a class row with subject + counts
// ---------------------------------------------------------------------------
export async function formatClass(c: any): Promise<any> {
  const sb = supabaseService()
  let memberCount = 0, lessonCount = 0, quizCount = 0
  try {
    const [m, l, q] = await Promise.all([
      sb.from('class_members').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
      sb.from('lesson_assignments').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
      sb.from('quiz_assignments').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
    ])
    memberCount = m.count ?? 0
    lessonCount = l.count ?? 0
    quizCount = q.count ?? 0
  } catch {}
  return {
    id: c.id,
    name: c.name,
    grade: c.grade,
    subjectId: c.subject_id,
    subject: c.subject ? {
      id: c.subject.id, name: c.subject.name,
      code: c.subject.code, color: c.subject.color,
    } : undefined,
    description: c.description,
    classCode: c.class_code,
    teacherId: c.teacher_id,
    teacher: c.teacher ? { id: c.teacher.id, name: c.teacher.name } : undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    _count: { members: memberCount, lessons: lessonCount, quizzes: quizCount },
  }
}
