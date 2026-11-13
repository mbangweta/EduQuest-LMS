import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// DELETE /api/classes/[id]/members/[userId]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const user = await requireUser()
    const { id, userId } = await ctx.params
    const sb = supabaseService()

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, teacher_id').eq('id', id).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (user.role !== 'ADMIN' && cls.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { error: delErr } = await sb.from('class_members').delete().eq('class_id', id).eq('learner_id', userId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
