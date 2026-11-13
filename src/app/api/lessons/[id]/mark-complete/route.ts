import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// POST /api/lessons/[id]/mark-complete — learner marks as complete
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['LEARNER'])
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: lesson, error: lErr } = await sb.from('lessons').select('id').eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    // Must be assigned to one of my classes
    const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
    const myClassIds = (myMembers || []).map((m: any) => m.class_id)
    if (myClassIds.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: assignRow } = await sb.from('lesson_assignments').select('id').eq('lesson_id', id).in('class_id', myClassIds).maybeSingle()
    if (!assignRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: progress, error: upErr } = await sb.from('lesson_progress').upsert({
      lesson_id: id,
      learner_id: user.id,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'lesson_id,learner_id' }).select('id, lesson_id, learner_id, completed, completed_at, created_at, updated_at').single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ progress })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
