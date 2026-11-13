import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/schools — list schools visible to the current user.
//   SUPER_USER: all schools.
//   Anyone else: their own school only.
//   Unauthenticated: nothing (used by public landing page? — no, requires auth here).
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = supabaseService()
  let q = sb.from('schools').select('id, name, code, address, phone, email, status, created_at').order('name', { ascending: true })
  if (user.role !== 'SUPER_USER') {
    if (!user.schoolId) return NextResponse.json({ schools: [] })
    q = q.eq('id', user.schoolId)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For super user, also include counts of users/classes per school
  if (user.role === 'SUPER_USER') {
    const enriched = await Promise.all((data || []).map(async (s: any) => {
      const [users, classes, teachers, learners] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', s.id),
        sb.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', s.id),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', s.id).eq('role', 'TEACHER'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', s.id).eq('role', 'LEARNER'),
      ])
      return {
        ...s,
        counts: {
          users: users.count ?? 0,
          classes: classes.count ?? 0,
          teachers: teachers.count ?? 0,
          learners: learners.count ?? 0,
        },
      }
    }))
    return NextResponse.json({ schools: enriched })
  }

  return NextResponse.json({ schools: data || [] })
}

// POST /api/schools — create a new school. SUPER_USER only.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'SUPER_USER') {
    return NextResponse.json({ error: 'Forbidden — super user only' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { name, code, address, phone, email } = body
  if (!name || !code) {
    return NextResponse.json({ error: 'name and code are required' }, { status: 400 })
  }
  const sb = supabaseService()
  const { data, error } = await sb.from('schools').insert({
    name, code: String(code).toUpperCase(), address, phone, email, status: 'ACTIVE',
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'School code already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ school: data }, { status: 201 })
}
