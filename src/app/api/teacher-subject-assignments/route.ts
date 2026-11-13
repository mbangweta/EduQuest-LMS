import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/teacher-subject-assignments
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'LEARNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const teacherId = url.searchParams.get('teacherId')
  const subjectId = url.searchParams.get('subjectId')
  const schoolId = url.searchParams.get('schoolId')
  const academicYearId = url.searchParams.get('academicYearId')

  const sb = supabaseService()
  let q = sb.from('teacher_subject_assignments').select(`
    id, teacher_id, subject_id, school_id, academic_year_id, assigned_at,
    teacher:profiles!teacher_id(id, name, email, avatar_color, role),
    subject:subjects(id, name, code, color),
    school:schools(id, name, code),
    academic_year:academic_years(id, name)
  `)
  if (user.role !== 'SUPER_USER') {
    if (!user.schoolId) return NextResponse.json({ assignments: [] })
    q = q.eq('school_id', user.schoolId)
  } else if (schoolId) {
    q = q.eq('school_id', schoolId)
  }
  if (teacherId) q = q.eq('teacher_id', teacherId)
  if (subjectId) q = q.eq('subject_id', subjectId)
  if (academicYearId) q = q.eq('academic_year_id', academicYearId)

  const { data, error } = await q.order('assigned_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data || [] })
}

// POST /api/teacher-subject-assignments
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { teacherId, subjectId, academicYearId } = body
  if (!teacherId || !subjectId) {
    return NextResponse.json({ error: 'teacherId and subjectId required' }, { status: 400 })
  }
  const sb = supabaseService()
  const { data: teacher } = await sb.from('profiles').select('id, school_id, role').eq('id', teacherId).maybeSingle()
  if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  if (teacher.role !== 'TEACHER') return NextResponse.json({ error: 'User is not a teacher' }, { status: 400 })
  if (!teacher.school_id) return NextResponse.json({ error: 'Teacher has no school' }, { status: 400 })
  if (user.role === 'SCHOOL_ADMIN' && teacher.school_id !== user.schoolId) {
    return NextResponse.json({ error: 'Forbidden — teacher not in your school' }, { status: 403 })
  }

  const { data, error } = await sb.from('teacher_subject_assignments').upsert({
    teacher_id: teacherId, subject_id: subjectId,
    school_id: teacher.school_id, academic_year_id: academicYearId ?? null,
  }, { onConflict: 'teacher_id,subject_id,school_id,academic_year_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignment: data }, { status: 201 })
}

// DELETE /api/teacher-subject-assignments
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const teacherId = url.searchParams.get('teacherId')
  const subjectId = url.searchParams.get('subjectId')
  const assignmentId = url.searchParams.get('assignmentId')
  if (!assignmentId && (!teacherId || !subjectId)) {
    return NextResponse.json({ error: 'Provide assignmentId OR (teacherId + subjectId)' }, { status: 400 })
  }
  const sb = supabaseService()
  let q = sb.from('teacher_subject_assignments').delete()
  if (assignmentId) q = q.eq('id', assignmentId)
  else q = q.eq('teacher_id', teacherId).eq('subject_id', subjectId)
  if (user.role === 'SCHOOL_ADMIN') q = q.eq('school_id', user.schoolId!)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
