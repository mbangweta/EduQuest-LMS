import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { notifySupabase } from '@/lib/notify-supabase'

function formatLessonRow(l: any) {
  return {
    id: l.id,
    title: l.title,
    grade: l.grade,
    subjectId: l.subject?.id ?? l.subject_id,
    subject: l.subject ? {
      id: l.subject.id, name: l.subject.name,
      code: l.subject.code, color: l.subject.color,
    } : undefined,
    topic: l.topic,
    objectives: l.objectives,
    notes: l.notes,
    activities: l.activities,
    examples: l.examples,
    practiceQuestions: l.practice_questions,
    homework: l.homework,
    summary: l.summary,
    attachments: l.attachments,
    videoLinks: l.video_links,
    status: l.status,
    teacherId: l.teacher_id,
    teacher: l.teacher ? {
      id: l.teacher.id, name: l.teacher.name,
      email: l.teacher.email, avatarColor: l.teacher.avatar_color,
    } : undefined,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }
}

// GET /api/lessons/[id]
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: lesson, error } = await sb.from('lessons').select(`
      id, title, grade, subject_id, topic, objectives, notes, activities, examples,
      practice_questions, homework, summary, attachments, video_links, status,
      teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color),
      assignments:lesson_assignments(id, lesson_id, class_id, due_date, assigned_at, class:classes(id, name))
    `).eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const base = formatLessonRow(lesson)
    const assignments = (lesson.assignments || []).map((a: any) => ({
      id: a.id, lessonId: a.lesson_id, classId: a.class_id,
      dueDate: a.due_date, assignedAt: a.assigned_at,
      class: a.class,
    }))

    if (user.role === 'TEACHER') {
      if (lesson.teacher_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ lesson: { ...base, assignments } })
    }
    if (user.role === 'ADMIN') {
      return NextResponse.json({ lesson: { ...base, assignments } })
    }
    // Learner: PUBLISHED + assigned to one of their classes
    if (lesson.status !== 'PUBLISHED') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: member } = await sb.from('class_members').select('id').eq('learner_id', user.id).maybeSingle()
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: assignRow } = await sb.from('lesson_assignments').select('id').eq('lesson_id', id).maybeSingle()
    // We need a join through class_members to lesson_assignments for the learner's classes.
    const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
    const myClassIds = (myMembers || []).map((m: any) => m.class_id)
    const { data: myAssign } = await sb.from('lesson_assignments').select('id').eq('lesson_id', id).in('class_id', myClassIds)
    if (!myAssign || myAssign.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    void assignRow

    const { data: progress } = await sb.from('lesson_progress').select('id, completed, completed_at, created_at, updated_at').eq('lesson_id', id).eq('learner_id', user.id).maybeSingle()
    return NextResponse.json({ lesson: { ...base, assignments, myProgress: progress } })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/lessons/[id]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: lesson, error: lErr } = await sb.from('lessons').select('id, teacher_id, title, status').eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && lesson.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const data: any = {}
    for (const k of ['title', 'topic', 'objectives', 'notes', 'activities', 'examples', 'practiceQuestions', 'homework', 'summary']) {
      if (k in body) {
        const snakeMap: any = { practiceQuestions: 'practice_questions' }
        const col = snakeMap[k] || k
        data[col] = body[k] ?? null
      }
    }
    if ('grade' in body) data.grade = Number(body.grade)
    if ('subjectId' in body) data.subject_id = String(body.subjectId)
    if ('status' in body) data.status = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(body.status) ? body.status : 'DRAFT'
    if ('attachments' in body) data.attachments = body.attachments ?? null
    if ('videoLinks' in body) data.video_links = body.videoLinks ?? null

    const wasDraft = lesson.status !== 'PUBLISHED'
    const willPublish = data.status === 'PUBLISHED' && wasDraft

    if (Object.keys(data).length > 0) {
      const { error: updErr } = await sb.from('lessons').update(data).eq('id', id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Notify learners when first published
    if (willPublish) {
      const { data: assigns } = await sb.from('lesson_assignments').select('class_id, class:classes(id, name)').eq('lesson_id', id)
      const classIds = (assigns || []).map((a: any) => a.class_id)
      if (classIds.length > 0) {
        const { data: members } = await sb.from('class_members').select('learner_id').in('class_id', classIds)
        const learnerIds = new Set<string>((members || []).map((m: any) => m.learner_id))
        for (const lid of learnerIds) {
          await notifySupabase(lid, {
            type: 'NEW_LESSON',
            title: 'New lesson assigned',
            message: `"${lesson.title}" is now available in your class.`,
            data: { lessonId: id },
          })
        }
      }
    }

    const { data: updated, error: fetchErr } = await sb.from('lessons').select(`
      id, title, grade, subject_id, topic, objectives, notes, activities, examples,
      practice_questions, homework, summary, attachments, video_links, status,
      teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color)
    `).eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    return NextResponse.json({ lesson: formatLessonRow(updated) })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lessons/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: lesson, error: lErr } = await sb.from('lessons').select('id, teacher_id').eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && lesson.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { error: delErr } = await sb.from('lessons').delete().eq('id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
