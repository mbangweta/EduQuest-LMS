import { NextResponse } from 'next/server'
import { requireUser, supabaseService, formatQuestion } from '@/lib/api-helpers'

// GET /api/analytics/quiz/[id] — same data as /api/quizzes/[id]/results
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error: qErr } = await sb.from('quizzes').select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at
    `).eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && quiz.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: attempts, error: aErr } = await sb.from('quiz_attempts').select(`
      id, quiz_id, learner_id, assignment_id, attempt_number, started_at, submitted_at,
      status, score, max_score, percentage, grade, passed, time_spent, created_at,
      learner:profiles(id, name, email, grade, avatar_color),
      answers:quiz_answers(id, attempt_id, question_id, learner_answer, is_correct,
        marks_awarded, ai_marking_result, teacher_override, graded_at,
        question:quiz_questions(id, type, question_text, options, correct_answer,
          accepted_answers, matching_pairs, marking_guide, numerical_tolerance,
          mark_allocation, explanation, "order", question_bank_id, created_at))
    `).eq('quiz_id', id).in('status', ['SUBMITTED', 'TIMED_OUT']).order('submitted_at', { ascending: false, nullsFirst: false })
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

    const aList = attempts || []
    const percentages = aList.map((a: any) => a.percentage ?? 0)
    const classAverage = percentages.length
      ? Math.round((percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length) * 10) / 10
      : 0
    const highest = percentages.length ? Math.max(...percentages) : 0
    const lowest = percentages.length ? Math.min(...percentages) : 0
    const passedCount = aList.filter((a: any) => a.passed).length
    const passRate = percentages.length ? Math.round((passedCount / percentages.length) * 100) : 0

    const buckets = [0, 0, 0, 0, 0]
    for (const p of percentages) {
      if (p < 20) buckets[0]++
      else if (p < 40) buckets[1]++
      else if (p < 60) buckets[2]++
      else if (p < 80) buckets[3]++
      else buckets[4]++
    }

    const attemptsByLearner = new Map<string, any[]>()
    for (const a of aList) {
      const list = attemptsByLearner.get(a.learner_id) ?? []
      list.push(a)
      attemptsByLearner.set(a.learner_id, list)
    }

    const perLearner: any[] = []
    for (const [learnerId, list] of Array.from(attemptsByLearner.entries())) {
      const sorted = list.slice().sort((x: any, y: any) =>
        new Date(y.submitted_at ?? 0).getTime() - new Date(x.submitted_at ?? 0).getTime(),
      )
      const latest = sorted[0]
      const highestPct = sorted.reduce((acc: number, x: any) => Math.max(acc, x.percentage ?? 0), 0)
      perLearner.push({
        learner: latest.learner,
        attempts: list.length,
        latestScore: latest.percentage,
        latestGrade: latest.grade,
        latestPassed: latest.passed,
        highest: highestPct,
        latestAttemptId: latest.id,
        latestSubmittedAt: latest.submitted_at,
        timeSpent: latest.time_spent,
      })
    }

    const formattedQuiz = {
      id: quiz.id, title: quiz.title, grade: quiz.grade, subjectId: quiz.subject_id,
      topic: quiz.topic, description: quiz.description, difficulty: quiz.difficulty,
      curriculum: quiz.curriculum, instructions: quiz.instructions,
      timeLimit: quiz.time_limit, passingScore: quiz.passing_score,
      maxAttempts: quiz.max_attempts, randomQuestionOrder: quiz.random_question_order,
      randomAnswerOrder: quiz.random_answer_order, allowRetakes: quiz.allow_retakes,
      showAnswers: quiz.show_answers, showExplanations: quiz.show_explanations,
      scorePolicy: quiz.score_policy, status: quiz.status, teacherId: quiz.teacher_id,
      createdAt: quiz.created_at, updatedAt: quiz.updated_at,
    }

    return NextResponse.json({
      quiz: formattedQuiz,
      stats: {
        classAverage,
        highest,
        lowest,
        passRate,
        totalAttempts: aList.length,
        uniqueLearners: attemptsByLearner.size,
        distribution: [
          { range: '0-20', count: buckets[0] },
          { range: '20-40', count: buckets[1] },
          { range: '40-60', count: buckets[2] },
          { range: '60-80', count: buckets[3] },
          { range: '80-100', count: buckets[4] },
        ],
      },
      perLearner,
      attempts: aList.map((a: any) => ({
        id: a.id,
        learnerId: a.learner_id,
        learner: a.learner,
        attemptNumber: a.attempt_number,
        score: a.score,
        maxScore: a.max_score,
        percentage: a.percentage,
        grade: a.grade,
        passed: a.passed,
        timeSpent: a.time_spent,
        submittedAt: a.submitted_at,
        answers: (a.answers || []).map((ans: any) => {
          const parsed = formatQuestion(ans.question)
          return {
            answerId: ans.id,
            questionId: ans.question_id,
            type: parsed.type,
            questionText: parsed.questionText,
            options: parsed.options,
            matchingPairs: parsed.matchingPairs,
            learnerAnswer: ans.learner_answer,
            correctAnswer: parsed.correctAnswer,
            acceptedAnswers: parsed.acceptedAnswers,
            markingGuide: parsed.markingGuide,
            isCorrect: ans.is_correct,
            marksAwarded: ans.marks_awarded,
            maxMarks: parsed.markAllocation,
            explanation: parsed.explanation,
            aiMarkingResult: ans.ai_marking_result,
            teacherOverride: ans.teacher_override,
          }
        }),
      })),
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
