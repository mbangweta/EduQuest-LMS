import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/assignments/[id] — fetch one assignment with submissions
// PATCH /api/assignments/[id] — update assignment fields
// DELETE /api/assignments/[id] — delete assignment

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const sb = supabaseService()
    const { id } = await params

    const { data, error } = await sb.from('assignments').select(`
      id, title, description, type, max_score, due_date, status, created_at,
      class_id, subject_id, teacher_id,
      class:classes(id, name, grade),
      subject:subjects(id, name, code, color),
      submissions:assignment_submissions(
        id, learner_id, score, feedback, status, submitted_at, graded_at, content,
        learner:profiles(id, name, avatar_color)
      )
    `).eq('id', id).maybeSingle()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ assignment: data })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()
    const { id } = await params

    const { data: existing } = await sb.from('assignments')
      .select('id, teacher_id, school_id').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role === 'TEACHER' && existing.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && existing.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const update: any = {}
    for (const k of ['title', 'description', 'type', 'max_score', 'due_date', 'status', 'subject_id']) {
      if (body[k] !== undefined) update[k] = body[k]
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const { data, error } = await sb.from('assignments').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assignment: data })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()
    const { id } = await params

    const { data: existing } = await sb.from('assignments')
      .select('id, teacher_id, school_id').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role === 'TEACHER' && existing.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && existing.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await sb.from('assignments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
