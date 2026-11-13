import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/analytics/learner
export async function GET() {
  try {
    const user = await requireUser(['LEARNER'])
    const sb = supabaseService()

    // Memberships with class info
    const { data: memberships, error: mErr } = await sb.from('class_members').select(`
      id, class_id, enrolled_at,
      class:classes(id, name, grade, subject_id, description, class_code, created_at, updated_at,
        subject:subjects(id, name, code, color),
        teacher:profiles(id, name, avatar_color))
    `).eq('learner_id', user.id)
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    const myClassIds = (memberships || []).map((m: any) => m.class_id)

    // Lesson assignments across my classes (published lessons)
    let availableLessons: any[] = []
    if (myClassIds.length > 0) {
      const { data: lessonAssigns } = await sb.from('lesson_assignments').select(`
        lesson_id,
        lesson:lessons(id, title, grade, subject_id, topic, objectives, notes, status, created_at, updated_at,
          subject:subjects(id, name, code, color))
      `).in('class_id', myClassIds)
      const lessonMap = new Map<string, any>()
      for (const la of (lessonAssigns || [])) {
        const l = la.lesson
        if (l && l.status === 'PUBLISHED' && !lessonMap.has(l.id)) lessonMap.set(l.id, l)
      }
      availableLessons = Array.from(lessonMap.values())
    }

    // Lesson progress (my completed)
    const { data: lessonProgress } = await sb.from('lesson_progress').select('lesson_id, completed').eq('learner_id', user.id).eq('completed', true)
    const completedLessonIds = new Set((lessonProgress || []).map((p: any) => p.lesson_id))

    // Quiz assignments across my classes (published quizzes)
    let quizMap = new Map<string, any>()
    if (myClassIds.length > 0) {
      const { data: quizAssigns } = await sb.from('quiz_assignments').select(`
        id, quiz_id, class_id, start_date, end_date, created_at,
        quiz:quizzes(id, title, grade, subject_id, topic, description, difficulty, status,
          passing_score, time_limit, max_attempts, allow_retakes, show_answers,
          subject:subjects(id, name, code, color))
      `).in('class_id', myClassIds)
      for (const qa of (quizAssigns || [])) {
        const qz = qa.quiz
        if (qz && qz.status === 'PUBLISHED' && !quizMap.has(qz.id)) {
          quizMap.set(qz.id, {
            quiz: {
              ...qz,
              subjectId: qz.subject_id,
              passingScore: qz.passing_score,
              timeLimit: qz.time_limit,
              maxAttempts: qz.max_attempts,
              allowRetakes: qz.allow_retakes,
              showAnswers: qz.show_answers,
            },
            assignment: {
              id: qa.id,
              quizId: qa.quiz_id,
              classId: qa.class_id,
              startDate: qa.start_date,
              endDate: qa.end_date,
              createdAt: qa.created_at,
            },
          })
        }
      }
    }

    // Attempts for these quizzes
    const myQuizIds = Array.from(quizMap.keys())
    let attempts: any[] = []
    if (myQuizIds.length > 0) {
      const { data: aRows } = await sb.from('quiz_attempts').select(`
        id, quiz_id, attempt_number, score, max_score, percentage, grade, passed,
        time_spent, started_at, submitted_at, status, created_at
      `).eq('learner_id', user.id).in('quiz_id', myQuizIds).eq('status', 'SUBMITTED').order('submitted_at', { ascending: false, nullsFirst: false })
      attempts = aRows || []
    }

    // Group attempts per quiz
    const attemptsByQuiz = new Map<string, any[]>()
    for (const a of attempts) {
      const list = attemptsByQuiz.get(a.quiz_id) ?? []
      list.push(a)
      attemptsByQuiz.set(a.quiz_id, list)
    }

    const pending: any[] = []
    const completed: any[] = []
    for (const [quizId, entry] of Array.from(quizMap.entries())) {
      const list = attemptsByQuiz.get(quizId) ?? []
      if (list.length === 0) {
        pending.push({ quiz: entry.quiz, assignment: entry.assignment })
        continue
      }
      const quiz = entry.quiz
      if (quiz.allowRetakes && (quiz.maxAttempts === 0 || list.length < quiz.maxAttempts)) {
        pending.push({ quiz, assignment: entry.assignment })
      }
      const best = list.reduce((acc: any, x: any) => ((x.percentage ?? 0) > (acc.percentage ?? 0) ? x : acc), list[0])
      completed.push({ quiz, attempt: best, attempts: list.length })
    }

    const avgScore = attempts.length
      ? Math.round((attempts.reduce((a: number, b: any) => a + (b.percentage ?? 0), 0) / attempts.length) * 10) / 10
      : 0

    const lessonsProgressPct = availableLessons.length
      ? Math.round((completedLessonIds.size / availableLessons.length) * 100)
      : 0

    const upcoming = pending
      .filter((p) => p.assignment?.endDate && new Date(p.assignment.endDate) > new Date())
      .sort((a, b) => new Date(a.assignment.endDate).getTime() - new Date(b.assignment.endDate).getTime())
      .slice(0, 5)

    const recentAttempts = attempts.slice(0, 5).map((a: any) => ({
      id: a.id,
      quizTitle: quizMap.get(a.quiz_id)?.quiz?.title ?? 'Quiz',
      score: a.score,
      maxScore: a.max_score,
      percentage: a.percentage,
      grade: a.grade,
      passed: a.passed,
      submittedAt: a.submitted_at,
    }))

    // Format enrolledClasses to match Prisma shape
    const enrolledClasses = (memberships || []).map((m: any) => {
      const c = m.class
      return {
        id: c?.id,
        name: c?.name,
        grade: c?.grade,
        subjectId: c?.subject_id,
        subject: c?.subject,
        description: c?.description,
        classCode: c?.class_code,
        teacherId: c?.teacher_id,
        teacher: c?.teacher,
        createdAt: c?.created_at,
        updatedAt: c?.updated_at,
      }
    })

    return NextResponse.json({
      counts: {
        classes: (memberships || []).length,
        availableLessons: availableLessons.length,
        completedLessons: completedLessonIds.size,
        pendingQuizzes: pending.length,
        completedQuizzes: completed.length,
        avgScore,
      },
      lessonsProgressPct,
      enrolledClasses,
      availableLessons: availableLessons.map((l: any) => ({
        ...l,
        subjectId: l.subject?.id ?? l.subject_id,
        completed: completedLessonIds.has(l.id),
      })),
      pending,
      completed,
      recentAttempts,
      upcoming,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
