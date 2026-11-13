import { NextResponse } from 'next/server'
import { requireUser, supabaseService, stripAnswerKey } from '@/lib/api-helpers'
import { markObjective, markShortAnswerQuestion, computeGrade, computePercentage, isPassed } from '@/lib/marking'
import { notifySupabase } from '@/lib/notify-supabase'

// POST /api/quizzes/[id]/submit — submit attempt. Body: { attemptId, answers: [{ questionId, learnerAnswer }] }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['LEARNER'])
    const { id } = await ctx.params
    const sb = supabaseService()

    const body = await req.json().catch(() => ({}))
    const { attemptId, answers } = body
    if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 })

    const { data: attempt, error: aErr } = await sb.from('quiz_attempts').select(`
      id, quiz_id, learner_id, assignment_id, attempt_number, started_at, submitted_at,
      status, score, max_score, percentage, grade, passed, time_spent, created_at
    `).eq('id', attemptId).maybeSingle()
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    if (attempt.quiz_id !== id) return NextResponse.json({ error: 'Attempt/quiz mismatch' }, { status: 400 })
    if (attempt.learner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Attempt already submitted' }, { status: 400 })
    }

    const { data: quiz } = await sb.from('quizzes').select('id, title, teacher_id, passing_score, show_answers, show_explanations').eq('id', id).maybeSingle()
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

    // Load all quiz questions
    const { data: questions, error: qErr } = await sb.from('quiz_questions').select('*').eq('quiz_id', id).order('order', { ascending: true })
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

    let totalScore = 0
    let maxScore = 0
    const answerRows: any[] = []
    const answersByQ = new Map<string, any>((answers || []).map((a: any) => [String(a.questionId), a.learnerAnswer]))

    for (const q of (questions || [])) {
      const markAllocation = q.mark_allocation ?? 1
      maxScore += markAllocation
      const learnerAnswer = answersByQ.get(q.id) ?? null
      let isCorrect = false
      let marksAwarded = 0
      let aiResult: any = null

      const parsed = {
        type: q.type,
        options: q.options ?? undefined,
        correctAnswer: q.correct_answer ?? undefined,
        acceptedAnswers: q.accepted_answers ?? undefined,
        matchingPairs: q.matching_pairs ?? undefined,
        markingGuide: q.marking_guide ?? undefined,
        numericalTolerance: q.numerical_tolerance ?? undefined,
        markAllocation,
      }

      if (learnerAnswer === null || learnerAnswer === undefined || learnerAnswer === '') {
        // empty answer → zero
      } else if (q.type === 'SHORT_ANSWER') {
        const r = await markShortAnswerQuestion(
          String(q.question_text ?? ''),
          q.marking_guide || '',
          String(learnerAnswer),
          markAllocation,
        )
        isCorrect = r.isCorrect
        marksAwarded = r.marksAwarded
        aiResult = { feedback: r.feedback, partial: r.partial, marks: r.marksAwarded, maxMarks: r.maxMarks }
      } else {
        const r = markObjective(parsed as any, learnerAnswer)
        isCorrect = r.isCorrect
        marksAwarded = r.marksAwarded
        if (r.feedback) aiResult = { feedback: r.feedback }
      }
      totalScore += marksAwarded
      answerRows.push({
        attempt_id: attempt.id,
        question_id: q.id,
        learner_answer: learnerAnswer ?? null,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
        ai_marking_result: aiResult,
        graded_at: new Date().toISOString(),
      })
    }

    // Insert answers
    if (answerRows.length > 0) {
      const { error: insErr } = await sb.from('quiz_answers').insert(answerRows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    const percentage = computePercentage(totalScore, maxScore)
    const grade = computeGrade(percentage)
    const passed = isPassed(percentage, quiz.passing_score)
    const timeSpent = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000)

    const { data: updated, error: updErr } = await sb.from('quiz_attempts').update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
      percentage,
      grade,
      passed,
      time_spent: timeSpent,
    }).eq('id', attempt.id).select(`
      id, quiz_id, learner_id, assignment_id, attempt_number, started_at, submitted_at,
      status, score, max_score, percentage, grade, passed, time_spent, created_at
    `).single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Notify teacher + learner
    await notifySupabase(quiz.teacher_id, {
      type: 'SUBMISSION',
      title: 'Quiz submitted',
      message: `${user.name} submitted "${quiz.title}" — ${percentage}% (${grade}).`,
      data: { attemptId: attempt.id, quizId: id, learnerId: user.id },
    })
    await notifySupabase(user.id, {
      type: 'RESULT',
      title: 'Quiz marked',
      message: `You scored ${percentage}% (${grade}) on "${quiz.title}".`,
      data: { attemptId: attempt.id, quizId: id },
    })

    // Build per-question result for learner (depends on showAnswers policy)
    const showAnswers = quiz.show_answers
    let breakdown: any[] = []
    if (showAnswers !== 'NEVER') {
      breakdown = (questions || []).map((q: any, i: number) => {
        const row = answerRows[i]
        const stripped = stripAnswerKey(q)
        return {
          questionId: q.id,
          type: q.type,
          questionText: q.question_text,
          options: q.options,
          matchingPairs: q.matching_pairs?.map((p: any) => ({ left: p.left, right: p.right })),
          learnerAnswer: row.learner_answer,
          correctAnswer: (showAnswers === 'AFTER_SUBMISSION' || showAnswers === 'AFTER_DEADLINE') ? q.correct_answer : undefined,
          acceptedAnswers: showAnswers === 'AFTER_SUBMISSION' ? q.accepted_answers : undefined,
          markingGuide: undefined,
          isCorrect: row.is_correct,
          marksAwarded: row.marks_awarded,
          maxMarks: q.mark_allocation ?? 1,
          explanation: quiz.show_explanations ? q.explanation : undefined,
          aiFeedback: row.ai_marking_result,
        }
      })
    }

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
        quiz: { id: quiz.id, title: quiz.title, teacherId: quiz.teacher_id, passingScore: quiz.passing_score, showAnswers: quiz.show_answers, showExplanations: quiz.show_explanations },
      },
      breakdown,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
