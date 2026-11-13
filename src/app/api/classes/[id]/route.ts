import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/classes/[id] — full detail
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: cls, error } = await sb.from('classes').select(`
      id, name, grade, subject_id, description, class_code, teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color),
      members:class_members(id, enrolled_at, learner:profiles(id, name, email, grade, avatar_color)),
      lesson_assignments:lesson_assignments(id, lesson_id, due_date, assigned_at, lesson:lessons(id, title, topic, grade, status)),
      quiz_assignments:quiz_assignments(id, quiz_id, start_date, end_date, created_at, quiz:quizzes(id, title, topic, status, passing_score, time_limit))
    `).eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Permission: admin any; teacher own; learner must be a member
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'LEARNER' && !(cls.members || []).some((m: any) => m.learner?.id === user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Counts
    const [m, l, q] = await Promise.all([
      sb.from('class_members').select('id', { count: 'exact', head: true }).eq('class_id', id),
      sb.from('lesson_assignments').select('id', { count: 'exact', head: true }).eq('class_id', id),
      sb.from('quiz_assignments').select('id', { count: 'exact', head: true }).eq('class_id', id),
    ])

    const formatted = {
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      subjectId: cls.subject?.id ?? cls.subject_id,
      subject: cls.subject,
      description: cls.description,
      classCode: cls.class_code,
      teacherId: cls.teacher_id,
      teacher: cls.teacher,
      createdAt: cls.created_at,
      updatedAt: cls.updated_at,
      members: (cls.members || []).map((m: any) => ({
        id: m.id,
        classId: id,
        learnerId: m.learner?.id,
        enrolledAt: m.enrolled_at,
        learner: m.learner,
      })),
      lessonAssignments: (cls.lesson_assignments || []).map((la: any) => ({
        id: la.id,
        lessonId: la.lesson_id,
        classId: id,
        dueDate: la.due_date,
        assignedAt: la.assigned_at,
        lesson: la.lesson,
      })),
      quizAssignments: (cls.quiz_assignments || []).map((qa: any) => ({
        id: qa.id,
        quizId: qa.quiz_id,
        classId: id,
        startDate: qa.start_date,
        endDate: qa.end_date,
        createdAt: qa.created_at,
        quiz: qa.quiz,
      })),
      _count: {
        members: m.count ?? 0,
        lessonAssignments: l.count ?? 0,
        quizAssignments: q.count ?? 0,
      },
    }
    return NextResponse.json({ class: formatted })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/classes/[id]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, teacher_id').eq('id', id).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && cls.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const data: any = {}
    if ('name' in body) data.name = String(body.name)
    if ('description' in body) data.description = body.description ? String(body.description) : null
    if ('grade' in body) data.grade = Number(body.grade)
    if ('subjectId' in body) data.subject_id = String(body.subjectId)

    if (Object.keys(data).length > 0) {
      const { error: updErr } = await sb.from('classes').update(data).eq('id', id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    const { data: updated, error: fetchErr } = await sb.from('classes').select(`
      id, name, grade, subject_id, description, class_code, teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color)
    `).eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const m = await sb.from('class_members').select('id', { count: 'exact', head: true }).eq('class_id', id)
    return NextResponse.json({
      class: {
        ...updated,
        subjectId: updated.subject?.id ?? updated.subject_id,
        classCode: updated.class_code,
        teacherId: updated.teacher_id,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        _count: { members: m.count ?? 0 },
      },
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/classes/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, teacher_id').eq('id', id).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && cls.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { error: delErr } = await sb.from('classes').delete().eq('id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
