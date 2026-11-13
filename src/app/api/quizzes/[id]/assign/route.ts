import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { notifySupabase } from '@/lib/notify-supabase'

// POST /api/quizzes/[id]/assign — assign quiz to class with start/end dates
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error: qErr } = await sb.from('quizzes').select('id, teacher_id, title, status').eq('id', id).maybeSingle()
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && quiz.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const { classId, startDate, endDate } = body
    if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 })

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, name').eq('id', classId).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    const { data: assignment, error: upErr } = await sb.from('quiz_assignments').upsert({
      quiz_id: id,
      class_id: classId,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
    }, { onConflict: 'quiz_id,class_id' }).select('id, quiz_id, class_id, start_date, end_date, created_at').single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    if (quiz.status === 'PUBLISHED') {
      const { data: members } = await sb.from('class_members').select('learner_id').eq('class_id', classId)
      for (const m of (members || [])) {
        await notifySupabase(m.learner_id, {
          type: 'NEW_QUIZ',
          title: 'New quiz assigned',
          message: `"${quiz.title}" was assigned in ${cls.name}.`,
          data: { quizId: id, classId },
        })
      }
    }
    return NextResponse.json({ assignment }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
