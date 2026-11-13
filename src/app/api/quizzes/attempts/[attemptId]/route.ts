import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/quizzes/attempts/[attemptId] — fetch one attempt with answers.
// Learner: only own. Teacher: only attempts in their quizzes. Admin: any.
// Strips answer keys if quiz.showAnswers is NEVER or AFTER_DEADLINE (and deadline not yet passed).
export async function GET(_req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireUser()
    const { attemptId } = await ctx.params
    const sb = supabaseService()

    const { data: attempt, error: aErr } = await sb.from('quiz_attempts').select(`
      id, quiz_id, learner_id, assignment_id, attempt_number, started_at, submitted_at,
      status, score, max_score, percentage, grade, passed, time_spent, created_at,
      quiz:quizzes(id, title, topic, subject_id, passing_score, show_answers, show_explanations,
        allow_retakes, max_attempts, teacher_id,
        subject:subjects(id, name, code, color)),
      learner:profiles(id, name, email, grade, avatar_color),
      answers:quiz_answers(id, attempt_id, question_id, learner_answer, is_correct,
        marks_awarded, ai_marking_result, teacher_override, graded_at,
        question:quiz_questions(id, type, question_text, options, correct_answer,
          accepted_answers, matching_pairs, marking_guide, numerical_tolerance,
          mark_allocation, explanation, "order", question_bank_id, created_at))
    `).eq('id', attemptId).maybeSingle()
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    if (user.role === 'LEARNER' && attempt.learner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'TEACHER' && attempt.quiz?.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Decide whether to reveal answer keys
    let revealKeys = true
    if (user.role === 'LEARNER') {
      const mode = attempt.quiz?.show_answers
      if (mode === 'NEVER') revealKeys = false
      else if (mode === 'AFTER_DEADLINE') {
        if (attempt.assignment_id) {
          const { data: assignment } = await sb.from('quiz_assignments').select('end_date').eq('id', attempt.assignment_id).maybeSingle()
          if (assignment?.end_date && new Date() < new Date(assignment.end_date)) revealKeys = false
        } else {
          revealKeys = false
        }
      }
    }

    const answers = (attempt.answers || []).map((ans: any) => {
      const q = ans.question
      const result: any = {
        answerId: ans.id,
        questionId: ans.question_id,
        type: q?.type,
        questionText: q?.question_text,
        options: q?.options,
        matchingPairs: q?.matching_pairs?.map((p: any) => ({ left: p.left, right: p.right })),
        learnerAnswer: ans.learner_answer,
        isCorrect: ans.is_correct,
        marksAwarded: ans.marks_awarded,
        maxMarks: q?.mark_allocation ?? 1,
        explanation: attempt.quiz?.show_explanations || user.role !== 'LEARNER' ? q?.explanation : undefined,
        aiMarkingResult: ans.ai_marking_result,
        teacherOverride: ans.teacher_override,
      }
      if (revealKeys || user.role !== 'LEARNER') {
        result.correctAnswer = q?.correct_answer
        result.acceptedAnswers = q?.accepted_answers
        result.markingGuide = q?.marking_guide
      }
      return result
    })

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        quizId: attempt.quiz_id,
        learnerId: attempt.learner_id,
        learner: attempt.learner,
        attemptNumber: attempt.attempt_number,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.max_score,
        percentage: attempt.percentage,
        grade: attempt.grade,
        passed: attempt.passed,
        timeSpent: attempt.time_spent,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
      },
      quiz: {
        id: attempt.quiz?.id,
        title: attempt.quiz?.title,
        topic: attempt.quiz?.topic,
        passingScore: attempt.quiz?.passing_score,
        showAnswers: attempt.quiz?.show_answers,
        showExplanations: attempt.quiz?.show_explanations,
        allowRetakes: attempt.quiz?.allow_retakes,
        maxAttempts: attempt.quiz?.max_attempts,
        subject: attempt.quiz?.subject,
      },
      answers,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
