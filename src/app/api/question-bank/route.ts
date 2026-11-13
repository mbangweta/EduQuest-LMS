import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

function formatQuestionBankRow(q: any) {
  return {
    id: q.id,
    grade: q.grade,
    subjectId: q.subject?.id ?? q.subject_id,
    subject: q.subject,
    topic: q.topic,
    type: q.type,
    questionText: q.question_text,
    options: q.options,
    correctAnswer: q.correct_answer,
    acceptedAnswers: q.accepted_answers,
    matchingPairs: q.matching_pairs,
    markingGuide: q.marking_guide,
    numericalTolerance: q.numerical_tolerance,
    markAllocation: q.mark_allocation,
    explanation: q.explanation,
    difficulty: q.difficulty,
    createdById: q.created_by_id,
    createdBy: q.created_by ? { id: q.created_by.id, name: q.created_by.name } : undefined,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  }
}

// GET /api/question-bank — list, filterable
export async function GET(req: Request) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const sb = supabaseService()

    const url = new URL(req.url)
    const gradeStr = url.searchParams.get('grade')
    const subjectId = url.searchParams.get('subjectId') || undefined
    const topic = url.searchParams.get('topic') || undefined
    const type = url.searchParams.get('type') || undefined
    const difficulty = url.searchParams.get('difficulty') || undefined
    const q = url.searchParams.get('q') || undefined

    let query = sb.from('question_bank').select(`
      id, grade, subject_id, topic, type, question_text, options, correct_answer,
      accepted_answers, matching_pairs, marking_guide, numerical_tolerance,
      mark_allocation, explanation, difficulty, created_by_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      created_by:profiles(id, name)
    `).order('created_at', { ascending: false })

    if (gradeStr) query = query.eq('grade', Number(gradeStr))
    if (subjectId) query = query.eq('subject_id', subjectId)
    if (topic) query = query.ilike('topic', `%${topic}%`)
    if (type) query = query.eq('type', type)
    if (difficulty) query = query.eq('difficulty', difficulty)
    if (q) query = query.ilike('question_text', `%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const questions = (data || []).map(formatQuestionBankRow)
    return NextResponse.json({ questions })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/question-bank — create
export async function POST(req: Request) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const sb = supabaseService()

    const body = await req.json().catch(() => ({}))
    const { grade, subjectId, topic, difficulty } = body
    if (!grade || !subjectId || !topic || !body.type || !body.questionText) {
      return NextResponse.json({ error: 'grade, subjectId, topic, type, questionText required' }, { status: 400 })
    }
    const { data: created, error: insErr } = await sb.from('question_bank').insert({
      grade: Number(grade),
      subject_id: String(subjectId),
      topic: String(topic),
      type: body.type,
      question_text: String(body.questionText),
      options: body.options ?? null,
      correct_answer: body.correctAnswer ?? null,
      accepted_answers: body.acceptedAnswers ?? null,
      matching_pairs: body.matchingPairs ?? null,
      marking_guide: body.markingGuide ?? null,
      numerical_tolerance: body.numericalTolerance ?? null,
      mark_allocation: body.markAllocation ?? 1,
      explanation: body.explanation ?? null,
      difficulty: difficulty ?? 'MEDIUM',
      created_by_id: user.id,
    }).select(`
      id, grade, subject_id, topic, type, question_text, options, correct_answer,
      accepted_answers, matching_pairs, marking_guide, numerical_tolerance,
      mark_allocation, explanation, difficulty, created_by_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      created_by:profiles(id, name)
    `).single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ question: formatQuestionBankRow(created) }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
