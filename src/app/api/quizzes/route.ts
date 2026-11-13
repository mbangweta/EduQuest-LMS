import { NextResponse } from 'next/server'
import { requireUser, supabaseService, formatQuestion } from '@/lib/api-helpers'

function formatQuizRow(q: any) {
  return {
    id: q.id,
    title: q.title,
    grade: q.grade,
    subjectId: q.subject?.id ?? q.subject_id,
    subject: q.subject ? {
      id: q.subject.id, name: q.subject.name,
      code: q.subject.code, color: q.subject.color,
    } : undefined,
    topic: q.topic,
    description: q.description,
    difficulty: q.difficulty,
    curriculum: q.curriculum,
    instructions: q.instructions,
    timeLimit: q.time_limit,
    passingScore: q.passing_score,
    maxAttempts: q.max_attempts,
    randomQuestionOrder: q.random_question_order,
    randomAnswerOrder: q.random_answer_order,
    allowRetakes: q.allow_retakes,
    showAnswers: q.show_answers,
    showExplanations: q.show_explanations,
    scorePolicy: q.score_policy,
    status: q.status,
    teacherId: q.teacher_id,
    teacher: q.teacher ? {
      id: q.teacher.id, name: q.teacher.name,
      email: q.teacher.email, avatarColor: q.teacher.avatar_color,
    } : undefined,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  }
}

// GET /api/quizzes — list quizzes scoped by role.
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const sb = supabaseService()

    const url = new URL(req.url)
    const gradeStr = url.searchParams.get('grade')
    const subjectId = url.searchParams.get('subjectId') || undefined
    const status = url.searchParams.get('status') || undefined
    const q = url.searchParams.get('q') || undefined

    let quizIds: string[] | null = null
    if (user.role === 'LEARNER') {
      const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
      const myClassIds = (myMembers || []).map((m: any) => m.class_id)
      if (myClassIds.length === 0) return NextResponse.json({ quizzes: [] })
      const { data: assigns } = await sb.from('quiz_assignments').select('quiz_id').in('class_id', myClassIds)
      quizIds = Array.from(new Set((assigns || []).map((a: any) => a.quiz_id)))
      if (quizIds.length === 0) return NextResponse.json({ quizzes: [] })
    }

    let query = sb.from('quizzes').select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color)
    `)
    if (user.role === 'TEACHER') query = query.eq('teacher_id', user.id)
    else if (user.role === 'LEARNER') {
      query = query.in('id', quizIds!).eq('status', 'PUBLISHED')
    }
    if (gradeStr) query = query.eq('grade', Number(gradeStr))
    if (subjectId) query = query.eq('subject_id', subjectId)
    if (status) query = query.eq('status', status)
    if (q) query = query.or(`title.ilike.%${q}%,topic.ilike.%${q}%`)
    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const quizzes = await Promise.all((data || []).map(async (qz: any) => {
      const [qs, as, at] = await Promise.all([
        sb.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', qz.id),
        sb.from('quiz_assignments').select('id', { count: 'exact', head: true }).eq('quiz_id', qz.id),
        sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', qz.id),
      ])
      return {
        ...formatQuizRow(qz),
        _count: { questions: qs.count ?? 0, assignments: as.count ?? 0, attempts: at.count ?? 0 },
      }
    }))
    return NextResponse.json({ quizzes })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/quizzes — create (teacher/admin). Body may include questions[] to create in one go.
export async function POST(req: Request) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const sb = supabaseService()

    const body = await req.json().catch(() => ({}))
    const {
      title, grade, subjectId, topic, description, difficulty, curriculum, instructions,
      timeLimit, passingScore, maxAttempts, randomQuestionOrder, randomAnswerOrder,
      allowRetakes, showAnswers, showExplanations, scorePolicy, status,
      questions,
    } = body

    if (!title || !grade || !subjectId || !topic) {
      return NextResponse.json({ error: 'title, grade, subjectId, topic are required' }, { status: 400 })
    }

    const { data: created, error: insErr } = await sb.from('quizzes').insert({
      title: String(title),
      grade: Number(grade),
      subject_id: String(subjectId),
      topic: String(topic),
      description: description ?? null,
      difficulty: difficulty ?? 'MEDIUM',
      curriculum: curriculum ?? 'ZAMBIAN',
      instructions: instructions ?? null,
      time_limit: Number(timeLimit ?? 30),
      passing_score: Number(passingScore ?? 50),
      max_attempts: Number(maxAttempts ?? 1),
      random_question_order: !!randomQuestionOrder,
      random_answer_order: !!randomAnswerOrder,
      allow_retakes: allowRetakes !== false,
      show_answers: showAnswers ?? 'AFTER_SUBMISSION',
      show_explanations: showExplanations !== false,
      score_policy: scorePolicy ?? 'HIGHEST',
      status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      teacher_id: user.id,
    }).select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email)
    `).single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    // Insert questions if provided
    if (Array.isArray(questions) && questions.length > 0) {
      const rows = (questions as any[]).map((q, i) => ({
        quiz_id: created.id,
        type: q.type,
        question_text: String(q.questionText ?? ''),
        options: q.options ?? null,
        correct_answer: q.correctAnswer ?? null,
        accepted_answers: q.acceptedAnswers ?? null,
        matching_pairs: q.matchingPairs ?? null,
        marking_guide: q.markingGuide ?? null,
        numerical_tolerance: q.numericalTolerance ?? null,
        mark_allocation: q.markAllocation ?? 1,
        explanation: q.explanation ?? null,
        order: i,
        question_bank_id: q.questionBankId ?? null,
      }))
      const { error: qInsErr } = await sb.from('quiz_questions').insert(rows)
      if (qInsErr) return NextResponse.json({ error: qInsErr.message }, { status: 500 })
    }

    const { data: fullQuiz } = await sb.from('quizzes').select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email)
    `).eq('id', created.id).single()

    const { data: qRows } = await sb.from('quiz_questions').select('*').eq('quiz_id', created.id).order('order', { ascending: true })
    return NextResponse.json({
      quiz: { ...formatQuizRow(fullQuiz), questions: (qRows || []).map(formatQuestion) },
    }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
