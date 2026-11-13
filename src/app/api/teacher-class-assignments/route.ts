import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/teacher-class-assignments — list teacher-class assignments.
// Query: ?teacherId=... ?classId=... ?schoolId=...
//   SUPER_USER: all. SCHOOL_ADMIN: own school. TEACHER: own. LEARNER: forbidden.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'LEARNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const teacherId = url.searchParams.get('teacherId')
  const classId = url.searchParams.get('classId')
  const schoolId = url.searchParams.get('schoolId')

  const sb = supabaseService()
  let q = sb.from('teacher_class_assignments').select(`
    id, teacher_id, class_id, school_id, assigned_at,
    teacher:profiles!teacher_id(id, name, email, avatar_color, role),
    class:classes!class_id(id, name, grade, class_code, subject_id),
    school:schools(id, name, code)
  `)

  if (user.role !== 'SUPER_USER') {
    if (!user.schoolId) return NextResponse.json({ assignments: [] })
    q = q.eq('school_id', user.schoolId)
  } else if (schoolId) {
    q = q.eq('school_id', schoolId)
  }
  if (teacherId) q = q.eq('teacher_id', teacherId)
  if (classId) q = q.eq('class_id', classId)

  const { data, error } = await q.order('assigned_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data || [] })
}

// POST /api/teacher-class-assignments — assign a teacher to a class.
// Body: { teacherId, classId }
// SUPER_USER: any. SCHOOL_ADMIN: both teacher + class must be in own school.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { teacherId, classId } = body
  if (!teacherId || !classId) {
    return NextResponse.json({ error: 'teacherId and classId required' }, { status: 400 })
  }
  const sb = supabaseService()

  // Verify the teacher and class belong to the same school
  const { data: teacher } = await sb.from('profiles').select('id, school_id, role').eq('id', teacherId).maybeSingle()
  const { data: classRow } = await sb.from('classes').select('id, school_id, teacher_id').eq('id', classId).maybeSingle()
  if (!teacher || !classRow) return NextResponse.json({ error: 'Teacher or class not found' }, { status: 404 })
  if (teacher.role !== 'TEACHER') return NextResponse.json({ error: 'User is not a teacher' }, { status: 400 })

  const schoolId = teacher.school_id ?? classRow.school_id
  if (user.role === 'SCHOOL_ADMIN') {
    if (teacher.school_id !== user.schoolId || classRow.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden — teacher and class must be in your school' }, { status: 403 })
    }
  }
  if (teacher.school_id && classRow.school_id && teacher.school_id !== classRow.school_id) {
    return NextResponse.json({ error: 'Teacher and class belong to different schools' }, { status: 400 })
  }

  const { data, error } = await sb.from('teacher_class_assignments').upsert({
    teacher_id: teacherId, class_id: classId, school_id: schoolId,
  }, { onConflict: 'teacher_id,class_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignment: data }, { status: 201 })
}

// DELETE /api/teacher-class-assignments — unassign.
// Query: ?teacherId=...&classId=... OR ?assignmentId=...
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const teacherId = url.searchParams.get('teacherId')
  const classId = url.searchParams.get('classId')
  const assignmentId = url.searchParams.get('assignmentId')
  if (!assignmentId && (!teacherId || !classId)) {
    return NextResponse.json({ error: 'Provide assignmentId OR (teacherId + classId)' }, { status: 400 })
  }
  const sb = supabaseService()
  let q = sb.from('teacher_class_assignments').delete()
  if (assignmentId) {
    q = q.eq('id', assignmentId)
  } else {
    q = q.eq('teacher_id', teacherId).eq('class_id', classId)
  }
  // School admin can only delete assignments in their school
  if (user.role === 'SCHOOL_ADMIN') {
    q = q.eq('school_id', user.schoolId!)
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
