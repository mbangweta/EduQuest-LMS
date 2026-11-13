import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// POST /api/notifications/read-all
export async function POST() {
  try {
    const user = await requireUser()
    const sb = supabaseService()

    const { error } = await sb.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
