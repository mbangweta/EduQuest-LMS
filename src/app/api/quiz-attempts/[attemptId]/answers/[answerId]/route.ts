import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { computeGrade, computePercentage, isPassed } from '@/lib/marking'

// PATCH /api/quiz-attempts/[attemptId]/answers/[answerId] — teacher override of marks
export async function PATCH(req: Request, ctx: { params: Promise<{ attemptId: string; answerId: string }> }) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const { attemptId, answerId } = await ctx.params
    const sb = supabaseService()

    // Load attempt + quiz (for teacher_id check + passing_score)
    const { data: attempt, error: aErr } = await sb.from('quiz_attempts').select(`
      id, quiz_id, learner_id,
      quiz:quizzes(id, teacher_id, passing_score)
    `).eq('id', attemptId).maybeSingle()
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && attempt.quiz?.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify answer belongs to this attempt
    const { data: answer, error: ansErr } = await sb.from('quiz_answers').select(`
      id, attempt_id, question_id, marks_awarded
    `).eq('id', answerId).eq('attempt_id', attemptId).maybeSingle()
    if (ansErr) return NextResponse.json({ error: ansErr.message }, { status: 500 })
    if (!answer) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const marksAwarded = Number(body.marksAwarded)
    if (Number.isNaN(marksAwarded)) return NextResponse.json({ error: 'marksAwarded required' }, { status: 400 })

    // Look up the question for maxMarks
    const { data: question } = await sb.from('quiz_questions').select('mark_allocation').eq('id', answer.question_id).maybeSingle()
    const maxMarks = question?.mark_allocation ?? 1
    const isCorrect = body.isCorrect !== undefined ? !!body.isCorrect : marksAwarded >= maxMarks

    const { error: updErr } = await sb.from('quiz_answers').update({
      marks_awarded: marksAwarded,
      is_correct: isCorrect,
      teacher_override: true,
      graded_at: new Date().toISOString(),
    }).eq('id', answerId)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Recompute totals
    const { data: allAnswers, error: aListErr } = await sb.from('quiz_answers').select(`
      marks_awarded,
      question:quiz_questions(mark_allocation)
    `).eq('attempt_id', attemptId)
    if (aListErr) return NextResponse.json({ error: aListErr.message }, { status: 500 })

    const totalScore = (allAnswers || []).reduce((acc: number, a: any) => acc + (a.marks_awarded ?? 0), 0)
    const maxScore = (allAnswers || []).reduce((acc: number, a: any) => acc + (a.question?.mark_allocation ?? 0), 0)
    const percentage = computePercentage(totalScore, maxScore)
    const grade = computeGrade(percentage)
    const passed = isPassed(percentage, attempt.quiz?.passing_score ?? 50)

    const { data: updated, error: attUpdErr } = await sb.from('quiz_attempts').update({
      score: totalScore,
      max_score: maxScore,
      percentage,
      grade,
      passed,
    }).eq('id', attemptId).select(`
      id, quiz_id, learner_id, assignment_id, attempt_number, started_at, submitted_at,
      status, score, max_score, percentage, grade, passed, time_spent, created_at
    `).single()
    if (attUpdErr) return NextResponse.json({ error: attUpdErr.message }, { status: 500 })

    return NextResponse.json({
      attempt: {
        ...updated,
        quizId: updated.quiz_id,
        learnerId: updated.learner_id,
        assignmentId: updated.assignment_id,
        attemptNumber: updated.attempt_number,
        startedAt: updated.started_at,
        submittedAt: updated.submitted_at,
        maxScore: updated.max_score,
        timeSpent: updated.time_spent,
        createdAt: updated.created_at,
      },
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
