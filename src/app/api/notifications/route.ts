import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/notifications — current user's notifications
export async function GET() {
  try {
    const user = await requireUser()
    const sb = supabaseService()

    const { data, error } = await sb.from('notifications').select(`
      id, user_id, type, title, message, data, read, created_at
    `).eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const notifications = (data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      read: n.read,
      createdAt: n.created_at,
    }))
    return NextResponse.json({ notifications })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
