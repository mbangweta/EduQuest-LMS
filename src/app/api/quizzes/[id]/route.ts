import { NextResponse } from 'next/server'
import { requireUser, supabaseService, formatQuestion, stripAnswerKey } from '@/lib/api-helpers'
import { notifySupabase } from '@/lib/notify-supabase'

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

// GET /api/quizzes/[id] — full detail.
// Learners receive questions WITHOUT answer keys.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error } = await sb.from('quizzes').select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color),
      assignments:quiz_assignments(id, quiz_id, class_id, start_date, end_date, created_at, class:classes(id, name))
    `).eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: qRows } = await sb.from('quiz_questions').select('*').eq('quiz_id', id).order('order', { ascending: true })

    if (user.role === 'TEACHER') {
      if (quiz.teacher_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({
        quiz: {
          ...formatQuizRow(quiz),
          assignments: (quiz.assignments || []).map((a: any) => ({
            id: a.id, quizId: a.quiz_id, classId: a.class_id,
            startDate: a.start_date, endDate: a.end_date, createdAt: a.created_at,
            class: a.class,
          })),
          questions: (qRows || []).map(formatQuestion),
        },
      })
    }
    if (user.role === 'ADMIN') {
      return NextResponse.json({
        quiz: {
          ...formatQuizRow(quiz),
          assignments: (quiz.assignments || []).map((a: any) => ({
            id: a.id, quizId: a.quiz_id, classId: a.class_id,
            startDate: a.start_date, endDate: a.end_date, createdAt: a.created_at,
            class: a.class,
          })),
          questions: (qRows || []).map(formatQuestion),
        },
      })
    }
    // Learner: PUBLISHED + assigned
    if (quiz.status !== 'PUBLISHED') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
    const myClassIds = (myMembers || []).map((m: any) => m.class_id)
    if (myClassIds.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: assignRow } = await sb.from('quiz_assignments').select('id').eq('quiz_id', id).in('class_id', myClassIds).maybeSingle()
    if (!assignRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
      quiz: {
        ...formatQuizRow(quiz),
        questions: (qRows || []).map(stripAnswerKey),
      },
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/quizzes/[id] — update (owner/admin). If `questions` provided, fully replace them.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error: qErr } = await sb.from('quizzes').select('id, teacher_id, title, status').eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && quiz.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))

    const data: any = {}
    const directFields = ['title', 'topic', 'description', 'difficulty', 'curriculum', 'instructions']
    for (const k of directFields) if (k in body) data[k] = body[k]
    if ('timeLimit' in body) data.time_limit = Number(body.timeLimit)
    if ('passingScore' in body) data.passing_score = Number(body.passingScore)
    if ('maxAttempts' in body) data.max_attempts = Number(body.maxAttempts)
    if ('randomQuestionOrder' in body) data.random_question_order = !!body.randomQuestionOrder
    if ('randomAnswerOrder' in body) data.random_answer_order = !!body.randomAnswerOrder
    if ('allowRetakes' in body) data.allow_retakes = !!body.allowRetakes
    if ('showExplanations' in body) data.show_explanations = !!body.showExplanations
    if ('showAnswers' in body) data.show_answers = body.showAnswers
    if ('scorePolicy' in body) data.score_policy = body.scorePolicy
    if ('status' in body) data.status = ['DRAFT', 'PUBLISHED', 'CLOSED'].includes(body.status) ? body.status : 'DRAFT'
    if ('grade' in body) data.grade = Number(body.grade)
    if ('subjectId' in body) data.subject_id = String(body.subjectId)

    const publishNotify = data.status === 'PUBLISHED' && quiz.status !== 'PUBLISHED'

    if (Object.keys(data).length > 0) {
      const { error: updErr } = await sb.from('quizzes').update(data).eq('id', id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Replace questions if provided
    if (Array.isArray(body.questions)) {
      await sb.from('quiz_questions').delete().eq('quiz_id', id)
      if (body.questions.length > 0) {
        const rows = (body.questions as any[]).map((q, i) => ({
          quiz_id: id,
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
    }

    if (publishNotify) {
      const { data: assigns } = await sb.from('quiz_assignments').select('class_id, class:classes(id, name)').eq('quiz_id', id)
      for (const a of (assigns || [])) {
        const { data: members } = await sb.from('class_members').select('learner_id').eq('class_id', a.class_id)
        for (const m of (members || [])) {
          await notifySupabase(m.learner_id, {
            type: 'NEW_QUIZ',
            title: 'New quiz published',
            message: `"${quiz.title}" is now available in ${a.class?.name ?? 'your class'}.`,
            data: { quizId: id, classId: a.class_id },
          })
        }
      }
    }

    const { data: updated, error: fetchErr } = await sb.from('quizzes').select(`
      id, title, grade, subject_id, topic, description, difficulty, curriculum, instructions,
      time_limit, passing_score, max_attempts, random_question_order, random_answer_order,
      allow_retakes, show_answers, show_explanations, score_policy, status, teacher_id,
      created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email)
    `).eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const { data: qRows } = await sb.from('quiz_questions').select('*').eq('quiz_id', id).order('order', { ascending: true })
    return NextResponse.json({ quiz: { ...formatQuizRow(updated), questions: (qRows || []).map(formatQuestion) } })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/quizzes/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error: qErr } = await sb.from('quizzes').select('id, teacher_id').eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && quiz.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { error: delErr } = await sb.from('quizzes').delete().eq('id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
