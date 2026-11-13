import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/academic-years — list academic years.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = supabaseService()
  const url = new URL(req.url)
  const schoolId = url.searchParams.get('schoolId')

  let q = sb.from('academic_years').select('id, school_id, name, start_date, end_date, is_current, status, created_at').order('name', { ascending: false })
  if (user.role === 'SUPER_USER') {
    if (schoolId) q = q.eq('school_id', schoolId)
  } else {
    if (!user.schoolId) return NextResponse.json({ academicYears: [] })
    q = q.eq('school_id', user.schoolId)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ academicYears: data || [] })
}

// POST /api/academic-years
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { name, startDate, endDate, isCurrent, schoolId: requestedSchoolId, status } = body
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  let schoolId: string
  if (user.role === 'SUPER_USER') {
    if (!requestedSchoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })
    schoolId = requestedSchoolId
  } else {
    if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    schoolId = user.schoolId
  }

  const sb = supabaseService()
  if (isCurrent) {
    await sb.from('academic_years').update({ is_current: false }).eq('school_id', schoolId)
  }
  const { data, error } = await sb.from('academic_years').insert({
    school_id: schoolId, name: String(name),
    start_date: startDate || null, end_date: endDate || null,
    is_current: !!isCurrent, status: status || 'ACTIVE',
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Year already exists for this school' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ academicYear: data }, { status: 201 })
}
