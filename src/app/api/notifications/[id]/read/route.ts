import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// POST /api/notifications/[id]/read — mark one as read
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    // Only update if owned by this user
    const { error } = await sb.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
