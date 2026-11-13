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

// PATCH /api/question-bank/[id] — update (creator or admin)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: q, error: qErr } = await sb.from('question_bank').select('id, created_by_id').eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && q.created_by_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const data: any = {}
    if ('topic' in body) data.topic = String(body.topic)
    if ('difficulty' in body) data.difficulty = body.difficulty
    if ('grade' in body) data.grade = Number(body.grade)
    if ('subjectId' in body) data.subject_id = String(body.subjectId)
    if ('type' in body) data.type = body.type
    if ('questionText' in body) data.question_text = String(body.questionText)
    if ('options' in body) data.options = body.options ?? null
    if ('correctAnswer' in body) data.correct_answer = body.correctAnswer ?? null
    if ('acceptedAnswers' in body) data.accepted_answers = body.acceptedAnswers ?? null
    if ('matchingPairs' in body) data.matching_pairs = body.matchingPairs ?? null
    if ('markingGuide' in body) data.marking_guide = body.markingGuide ?? null
    if ('numericalTolerance' in body) data.numerical_tolerance = body.numericalTolerance ?? null
    if ('markAllocation' in body) data.mark_allocation = body.markAllocation ?? 1
    if ('explanation' in body) data.explanation = body.explanation ?? null

    if (Object.keys(data).length > 0) {
      const { error: updErr } = await sb.from('question_bank').update(data).eq('id', id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    const { data: updated, error: fetchErr } = await sb.from('question_bank').select(`
      id, grade, subject_id, topic, type, question_text, options, correct_answer,
      accepted_answers, matching_pairs, marking_guide, numerical_tolerance,
      mark_allocation, explanation, difficulty, created_by_id, created_at, updated_at,
      subject:subjects(id, name, code, color)
    `).eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    return NextResponse.json({ question: formatQuestionBankRow(updated) })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/question-bank/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: q, error: qErr } = await sb.from('question_bank').select('id, created_by_id').eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && q.created_by_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { error: delErr } = await sb.from('question_bank').delete().eq('id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
