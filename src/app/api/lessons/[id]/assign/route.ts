import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { notifySupabase } from '@/lib/notify-supabase'

// POST /api/lessons/[id]/assign — assign lesson to class
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: lesson, error: lErr } = await sb.from('lessons').select('id, teacher_id, title, status').eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && lesson.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const { classId, dueDate } = body
    if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 })

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, name').eq('id', classId).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    const { data: assignment, error: upErr } = await sb.from('lesson_assignments').upsert({
      lesson_id: id,
      class_id: classId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    }, { onConflict: 'lesson_id,class_id' }).select('id, lesson_id, class_id, due_date, assigned_at').single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    if (lesson.status === 'PUBLISHED') {
      const { data: members } = await sb.from('class_members').select('learner_id').eq('class_id', classId)
      for (const m of (members || [])) {
        await notifySupabase(m.learner_id, {
          type: 'NEW_LESSON',
          title: 'New lesson assigned',
          message: `"${lesson.title}" was assigned in ${cls.name}.`,
          data: { lessonId: id, classId },
        })
      }
    }
    return NextResponse.json({ assignment }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
