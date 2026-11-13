import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/analytics/teacher
export async function GET() {
  try {
    const user = await requireUser(['TEACHER'])
    const sb = supabaseService()

    // Counts for teacher's own resources
    const [classCount, lessonCount, quizCount] = await Promise.all([
      sb.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
      sb.from('lessons').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id).eq('status', 'PUBLISHED'),
      sb.from('quizzes').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id).eq('status', 'PUBLISHED'),
    ])

    // All my classes with members
    const { data: myClasses } = await sb.from('classes').select(`
      id, name,
      members:class_members(id, learner_id, learner:profiles(id, name, avatar_color))
    `).eq('teacher_id', user.id)
    const learnerSet = new Set<string>()
    for (const c of (myClasses || [])) for (const m of (c.members || [])) learnerSet.add(m.learner_id)
    const totalLearners = learnerSet.size

    // My quizzes (for recent submissions + pass rates)
    const { data: myQuizRows } = await sb.from('quizzes').select('id, title').eq('teacher_id', user.id)
    const myQuizIds = (myQuizRows || []).map((q: any) => q.id)

    // Recent attempts
    let recentAttempts: any[] = []
    if (myQuizIds.length > 0) {
      const { data, error } = await sb.from('quiz_attempts').select(`
        id, quiz_id, learner_id, attempt_number, score, max_score, percentage, grade,
        passed, time_spent, submitted_at, status,
        quiz:quizzes(id, title),
        learner:profiles(id, name, avatar_color)
      `).in('quiz_id', myQuizIds).eq('status', 'SUBMITTED').order('submitted_at', { ascending: false, nullsFirst: false }).limit(8)
      if (!error) {
        recentAttempts = (data || []).map((a: any) => ({
          ...a,
          quizId: a.quiz_id,
          learnerId: a.learner_id,
          attemptNumber: a.attempt_number,
          maxScore: a.max_score,
          timeSpent: a.time_spent,
          submittedAt: a.submitted_at,
        }))
      }
    }

    // Per-class performance
    const classPerformance = await Promise.all(
      (myClasses || []).map(async (c: any) => {
        // attempts where assignment.class_id = c.id
        const { data: attempts, error } = await sb.from('quiz_attempts').select(`
          percentage,
          assignment:quiz_assignments(class_id)
        `).eq('status', 'SUBMITTED')
        if (error) return { classId: c.id, className: c.name, learnerCount: (c.members || []).length, avgScore: 0, attempts: 0 }
        const filtered = (attempts || []).filter((a: any) => a.assignment?.class_id === c.id)
        const avg = filtered.length
          ? Math.round((filtered.reduce((a: number, b: any) => a + (b.percentage ?? 0), 0) / filtered.length) * 10) / 10
          : 0
        return {
          classId: c.id,
          className: c.name,
          learnerCount: (c.members || []).length,
          avgScore: avg,
          attempts: filtered.length,
        }
      }),
    )

    // Pass rate per quiz
    const passRatePerQuiz = await Promise.all(
      (myQuizRows || []).map(async (q: any) => {
        const { data: attempts } = await sb.from('quiz_attempts').select('passed, percentage').eq('quiz_id', q.id).eq('status', 'SUBMITTED')
        const list = attempts || []
        const passedCount = list.filter((a: any) => a.passed).length
        const passRate = list.length ? Math.round((passedCount / list.length) * 100) : 0
        const avg = list.length
          ? Math.round((list.reduce((a: number, b: any) => a + (b.percentage ?? 0), 0) / list.length) * 10) / 10
          : 0
        return { quizId: q.id, title: q.title, attempts: list.length, passRate, avgScore: avg }
      }),
    )

    return NextResponse.json({
      counts: {
        classes: classCount.count ?? 0,
        lessons: lessonCount.count ?? 0,
        quizzes: quizCount.count ?? 0,
        totalLearners,
      },
      recentAttempts,
      classPerformance,
      passRatePerQuiz,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
