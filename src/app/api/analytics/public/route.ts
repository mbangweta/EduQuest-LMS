import { NextResponse } from 'next/server'
import { supabaseConfigured } from '@/lib/supabase'

// Public analytics — anonymous aggregate counts only (no PII).
// Used by the public landing page to show live platform activity.
//
// Falls back to the local Prisma/SQLite DB when Supabase env vars aren't set
// (so the landing page works in the sandbox preview). When Supabase IS
// configured, reads from Supabase Postgres.
export async function GET() {
  if (!supabaseConfigured) {
    // Fallback: read from local Prisma DB (still has the seed data)
    return prismaFallback()
  }
  try {
    const { supabaseService } = await import('@/lib/api-helpers')
    const sb = supabaseService()

    // Batch 1: Core counts (12 parallel head-only queries)
    const [
      userCount, teacherCount, learnerCount, classCount, subjectCount,
      lessonCount, quizCount, attemptCount, publishedLessons, publishedQuizzes,
      schoolCount, libraryCount,
    ] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'TEACHER').eq('status', 'ACTIVE'),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'LEARNER').eq('status', 'ACTIVE'),
      sb.from('classes').select('id', { count: 'exact', head: true }),
      sb.from('subjects').select('id', { count: 'exact', head: true }),
      sb.from('lessons').select('id', { count: 'exact', head: true }),
      sb.from('quizzes').select('id', { count: 'exact', head: true }),
      sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      sb.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
      sb.from('quizzes').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
      sb.from('schools').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      sb.from('library_resources').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
    ])

    // Batch 2: Fetch subjects + recent lessons in parallel (skip per-subject counts
    // to avoid 24 extra queries — the landing page doesn't need exact counts per subject)
    const [subjectsResult, recentLessonsResult] = await Promise.all([
      sb.from('subjects').select('id, name, code, description, color').order('name', { ascending: true }),
      sb.from('lessons').select(`
        id, title, grade, topic,
        subject:subjects(name, color),
        teacher:profiles(name)
      `).eq('status', 'PUBLISHED').order('created_at', { ascending: false }).limit(6),
    ])

    if (subjectsResult.error) return NextResponse.json({ error: subjectsResult.error.message }, { status: 500 })

    const subjectsWithCounts = (subjectsResult.data || []).map((s: any) => ({
      id: s.id, name: s.name, code: s.code,
      description: s.description, color: s.color,
      lessonCount: 0, quizCount: 0,  // Skip per-subject counts for landing page performance
    }))

    const recentLessons = recentLessonsResult.data || []

    return NextResponse.json({
      counts: {
        users: userCount.count ?? 0,
        teachers: teacherCount.count ?? 0,
        learners: learnerCount.count ?? 0,
        classes: classCount.count ?? 0,
        subjects: subjectCount.count ?? 0,
        lessons: lessonCount.count ?? 0,
        quizzes: quizCount.count ?? 0,
        attempts: attemptCount.count ?? 0,
        publishedLessons: publishedLessons.count ?? 0,
        publishedQuizzes: publishedQuizzes.count ?? 0,
        schools: schoolCount.count ?? 0,
        libraryResources: libraryCount.count ?? 0,
      },
      subjects: subjectsWithCounts,
      recentLessons: (recentLessons || []).map((l: any) => ({
        id: l.id, title: l.title, grade: l.grade, topic: l.topic,
        subject: l.subject, teacher: l.teacher,
      })),
    })
  } catch (e: any) {
    console.error('[/api/analytics/public] Supabase error, falling back to Prisma:', e?.message)
    return prismaFallback()
  }
}

// Prisma fallback — reads from local SQLite. Used when Supabase isn't configured
// (e.g., sandbox preview) so the public landing page still shows live data.
async function prismaFallback() {
  try {
    const { db } = await import('@/lib/db')
    const [
      userCount, teacherCount, learnerCount, classCount, subjectCount,
      lessonCount, quizCount, attemptCount, publishedLessons, publishedQuizzes,
    ] = await Promise.all([
      db.user.count({ where: { status: 'ACTIVE' } }),
      db.user.count({ where: { role: 'TEACHER', status: 'ACTIVE' } }),
      db.user.count({ where: { role: 'LEARNER', status: 'ACTIVE' } }),
      db.class.count(),
      db.subject.count(),
      db.lesson.count(),
      db.quiz.count(),
      db.quizAttempt.count({ where: { status: 'SUBMITTED' } }),
      db.lesson.count({ where: { status: 'PUBLISHED' } }),
      db.quiz.count({ where: { status: 'PUBLISHED' } }),
    ])
    const subjects = await db.subject.findMany({
      include: { _count: { select: { lessons: true, quizzes: true } } },
      orderBy: { name: 'asc' },
    })
    const recentLessons = await db.lesson.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true, title: true, grade: true, topic: true,
        subject: { select: { name: true, color: true } },
        teacher: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })
    return NextResponse.json({
      counts: {
        users: userCount, teachers: teacherCount, learners: learnerCount,
        classes: classCount, subjects: subjectCount,
        lessons: lessonCount, quizzes: quizCount, attempts: attemptCount,
        publishedLessons, publishedQuizzes,
      },
      subjects: subjects.map((s) => ({
        id: s.id, name: s.name, code: s.code,
        description: s.description, color: s.color,
        lessonCount: s._count.lessons, quizCount: s._count.quizzes,
      })),
      recentLessons,
    })
  } catch (e: any) {
    console.error('[/api/analytics/public] Prisma fallback failed:', e?.message)
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 500 })
  }
}
