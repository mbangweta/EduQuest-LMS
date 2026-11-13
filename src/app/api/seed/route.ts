import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { runSeed } from '@/lib/seed'

// POST /api/seed — re-seed the database. Admin-only.
// If the database is already seeded, set ?force=1 to wipe & re-seed.
export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null)
  // Allow first-seed (no auth) only if the DB has no users yet.
  const { db } = await import('@/lib/db')
  const userCount = await db.user.count()
  if (userCount > 0 && (!user || user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized — admin only when DB is already seeded.' }, { status: 403 })
  }
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'
  if (force) {
    // Wipe all tables
    await db.quizAnswer.deleteMany()
    await db.quizAttempt.deleteMany()
    await db.quizAssignment.deleteMany()
    await db.quizQuestion.deleteMany()
    await db.quiz.deleteMany()
    await db.lessonProgress.deleteMany()
    await db.lessonAssignment.deleteMany()
    await db.lesson.deleteMany()
    await db.classMember.deleteMany()
    await db.class.deleteMany()
    await db.questionBank.deleteMany()
    await db.notification.deleteMany()
    await db.user.deleteMany()
    await db.subject.deleteMany()
    console.log('Database wiped.')
  }
  const result = await runSeed()
  return NextResponse.json({ ok: true, ...result })
}
