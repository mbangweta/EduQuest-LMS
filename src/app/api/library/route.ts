import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/library — list library resources visible to the current user.
//   SUPER_USER: all resources.
//   SCHOOL_ADMIN/TEACHER: their school's resources + global (school_id IS NULL).
//   LEARNER: their school's PUBLISHED resources + global PUBLISHED resources.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const grade = url.searchParams.get('grade')
  const subjectId = url.searchParams.get('subjectId')
  const paperType = url.searchParams.get('paperType')
  const q = url.searchParams.get('q')
  const schoolId = url.searchParams.get('schoolId')  // super user can filter by school

  const sb = supabaseService()
  let query = sb.from('library_resources')
    .select(`
      id, title, description, grade, year, paper_type, file_url, file_type, file_size,
      status, created_at, updated_at, school_id,
      subject:subjects(id, name, code, color),
      uploaded_by:profiles(id, name),
      school:schools(id, name, code)
    `)
    .order('created_at', { ascending: false })

  // Scope by role
  if (user.role === 'SUPER_USER') {
    if (schoolId) {
      query = query.eq('school_id', schoolId)
    } else if (schoolId === 'global') {
      query = query.is('school_id', null)
    }
    // No filter — sees all
  } else if (user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER') {
    if (!user.schoolId) return NextResponse.json({ resources: [] })
    // Their school's resources (any status) + global resources (any status)
    query = query.or(`school_id.eq.${user.schoolId},school_id.is.null`)
  } else {
    // LEARNER — published only, own school + global
    if (!user.schoolId) return NextResponse.json({ resources: [] })
    query = query.eq('status', 'PUBLISHED').or(`school_id.eq.${user.schoolId},school_id.is.null`)
  }

  if (grade) query = query.eq('grade', Number(grade))
  if (subjectId) query = query.eq('subject_id', subjectId)
  if (paperType) query = query.eq('paper_type', paperType)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resources: data || [] })
}

// POST /api/library — upload a new library resource.
// SUPER_USER: any school or global (school_id = NULL).
// SCHOOL_ADMIN/TEACHER: their school only.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden — learners cannot upload' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    title, description, subjectId, grade, year, paperType, fileUrl, fileType,
    fileSize, schoolId: requestedSchoolId, status,
  } = body
  if (!title || !fileUrl) {
    return NextResponse.json({ error: 'title and fileUrl are required' }, { status: 400 })
  }

  // Resolve school_id
  let schoolId: string | null = null
  if (user.role === 'SUPER_USER') {
    schoolId = requestedSchoolId ?? null  // null = global
  } else {
    if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden — cannot upload to other schools' }, { status: 403 })
    }
    schoolId = user.schoolId
  }

  const sb = supabaseService()
  const { data, error } = await sb.from('library_resources').insert({
    school_id: schoolId,
    title, description,
    subject_id: subjectId ?? null,
    grade: grade ?? null,
    year: year ?? null,
    paper_type: paperType ?? 'EXAM',
    file_url: fileUrl,
    file_type: fileType ?? null,
    file_size: fileSize ?? null,
    uploaded_by_id: user.id,
    status: status ?? 'PUBLISHED',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data }, { status: 201 })
}
