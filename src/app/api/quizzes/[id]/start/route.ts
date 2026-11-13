import { NextResponse } from 'next/server'
import { requireUser, supabaseService, stripAnswerKey } from '@/lib/api-helpers'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// POST /api/quizzes/[id]/start — learner starts a new attempt
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['LEARNER'])
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error: qErr } = await sb.from('quizzes').select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at
    `).eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    if (quiz.status !== 'PUBLISHED') return NextResponse.json({ error: 'Quiz not published' }, { status: 400 })

    // must be assigned to one of my classes
    const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
    const myClassIds = (myMembers || []).map((m: any) => m.class_id)
    if (myClassIds.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: assigns, error: aErr } = await sb.from('quiz_assignments').select('id, start_date, end_date').eq('quiz_id', id).in('class_id', myClassIds)
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    if (!assigns || assigns.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const assignment = assigns[0]
    const now = new Date()
    if (assignment.start_date && now < new Date(assignment.start_date)) {
      return NextResponse.json({ error: 'Quiz not yet open' }, { status: 400 })
    }
    if (assignment.end_date && now > new Date(assignment.end_date)) {
      return NextResponse.json({ error: 'Quiz deadline has passed' }, { status: 400 })
    }

    // Validate max attempts (0 = unlimited)
    if (quiz.max_attempts > 0) {
      const { count } = await sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', id).eq('learner_id', user.id)
      if ((count ?? 0) >= quiz.max_attempts) {
        return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 400 })
      }
    }

    const { count: attemptCount } = await sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', id).eq('learner_id', user.id)
    const attemptNumber = (attemptCount ?? 0) + 1
    const { data: attempt, error: insErr } = await sb.from('quiz_attempts').insert({
      quiz_id: id,
      learner_id: user.id,
      assignment_id: assignment.id,
      attempt_number: attemptNumber,
      status: 'IN_PROGRESS',
      started_at: now.toISOString(),
    }).select('id, quiz_id, learner_id, assignment_id, attempt_number, started_at, submitted_at, status, score, max_score, percentage, grade, passed, time_spent, created_at').single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    // Load questions, optionally shuffle
    const { data: qRows } = await sb.from('quiz_questions').select('*').eq('quiz_id', id).order('order', { ascending: true })
    let ordered: any[] = (qRows || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      accepted_answers: q.accepted_answers,
      matching_pairs: q.matching_pairs,
      marking_guide: q.marking_guide,
      numerical_tolerance: q.numerical_tolerance,
      mark_allocation: q.mark_allocation,
      explanation: q.explanation,
      order: q.order,
      question_bank_id: q.question_bank_id,
      created_at: q.created_at,
    }))
    if (quiz.random_question_order && ordered.length > 1) {
      ordered = shuffle(ordered)
    }
    if (quiz.random_answer_order) {
      ordered = ordered.map((q) => {
        if (q.type === 'MULTIPLE_CHOICE' && q.options && q.options.length > 1) {
          const letters = ['A', 'B', 'C', 'D', 'E', 'F']
          const opts = q.options.map((opt: string, idx: number) => ({ opt, letter: letters[idx] }))
          const correctLetter = String(q.correct_answer).toUpperCase()
          const correctOpt = opts.find((o: any) => o.letter === correctLetter)?.opt ?? opts[0].opt
          const shuffled = shuffle(opts.map((o: any) => o.opt))
          const newCorrectIdx = shuffled.indexOf(correctOpt)
          return {
            ...q,
            options: shuffled.map((o: string, idx: number) => `${letters[idx]}. ${o.replace(/^[A-Z]\.\s*/, '')}`),
            correct_answer: letters[newCorrectIdx] ?? correctLetter,
          }
        }
        return q
      })
    }
    const safeQuestions = ordered.map(stripAnswerKey)

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
      questions: undefined as any,
    }

    return NextResponse.json({
      attempt: {
        ...attempt,
        attemptNumber: attempt.attempt_number,
        quizId: attempt.quiz_id,
        learnerId: attempt.learner_id,
        assignmentId: attempt.assignment_id,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
        maxScore: attempt.max_score,
        timeSpent: attempt.time_spent,
        createdAt: attempt.created_at,
      },
      questions: safeQuestions,
      quiz: formattedQuiz,
    }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
