import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/assessments/[id] — fetch one assessment
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const { id } = await params
    const sb = supabaseService()

    const { data: a, error } = await sb.from('assessments').select(`
      id, title, description, type, term, subject_id, grade, class_id, teacher_id,
      date, max_score, weight, status, academic_year_id, school_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name),
      class:classes(id, name, grade, class_code)
    `).eq('id', id).single()
    if (error || !a) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    if (user.role !== 'SUPER_USER' && a.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'TEACHER' && a.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'LEARNER') {
      if (a.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (a.class_id) {
        const { data: membership } = await sb.from('class_members')
          .select('id').eq('class_id', a.class_id).eq('learner_id', user.id).maybeSingle()
        if (!membership) {
          return NextResponse.json({ error: 'Forbidden — not enrolled' }, { status: 403 })
        }
      }
    }

    const { count } = await sb.from('assessment_scores')
      .select('id', { count: 'exact', head: true }).eq('assessment_id', id)

    return NextResponse.json({
      assessment: {
        id: a.id,
        title: a.title,
        description: a.description,
        type: a.type,
        term: a.term,
        subjectId: a.subject_id,
        subject: a.subject,
        grade: a.grade,
        classId: a.class_id,
        className: a.class?.name,
        classCode: a.class?.class_code,
        teacherId: a.teacher_id,
        teacherName: a.teacher?.name,
        date: a.date,
        maxScore: a.max_score,
        weight: Number(a.weight),
        status: a.status,
        academicYearId: a.academic_year_id,
        schoolId: a.school_id,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        _count: { scores: count ?? 0 },
      },
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/assessments/[id] — update assessment metadata
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const { id } = await params
    const sb = supabaseService()

    const { data: existing } = await sb.from('assessments')
      .select('id, school_id, teacher_id').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (user.role === 'TEACHER' && existing.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && existing.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const update: Record<string, any> = {}
    for (const k of ['title', 'description', 'type', 'subject_id', 'grade', 'class_id', 'date', 'status', 'academic_year_id']) {
      if (body[k] !== undefined) update[k] = body[k]
    }
    if (body.term !== undefined) update.term = Number(body.term)
    if (body.maxScore !== undefined) update.max_score = Number(body.maxScore)
    if (body.weight !== undefined) update.weight = Number(body.weight)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await sb.from('assessments').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assessment: data })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/assessments/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const { id } = await params
    const sb = supabaseService()

    const { data: existing } = await sb.from('assessments')
      .select('id, school_id, teacher_id').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (user.role === 'TEACHER' && existing.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && existing.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await sb.from('assessments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
