import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/audit-logs — list audit logs.
//   SUPER_USER: all logs (or filter by ?schoolId=).
//   SCHOOL_ADMIN: own school's logs.
//   Others: forbidden.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const schoolId = url.searchParams.get('schoolId')
  const action = url.searchParams.get('action')
  const q = url.searchParams.get('q')
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500)

  const sb = supabaseService()
  let query = sb.from('audit_logs').select(`
    id, actor_id, actor_email, actor_role, school_id, action, entity_type, entity_id,
    description, metadata, ip_address, user_agent, created_at,
    actor:profiles!actor_id(id, name, avatar_color),
    school:schools(id, name, code)
  `).order('created_at', { ascending: false }).limit(limit)

  if (user.role === 'SUPER_USER') {
    if (schoolId) query = query.eq('school_id', schoolId)
  } else {
    if (!user.schoolId) return NextResponse.json({ logs: [] })
    query = query.eq('school_id', user.schoolId)
  }
  if (action) query = query.eq('action', action)
  if (q) query = query.or(`description.ilike.%${q}%,actor_email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data || [] })
}
