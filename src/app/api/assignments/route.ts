import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// ============================================================================
// GET /api/assignments?classId=...&status=...
//   List assignments for a class (teacher/admin) or for the learner's classes.
//
// POST /api/assignments
//   Create a new assignment. Body:
//   { classId, title, description, subjectId?, dueDate, maxScore, type? }
//   type: 'HOMEWORK' | 'ASSIGNMENT' | 'PROJECT' (default ASSIGNMENT)
// ============================================================================

export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const status = url.searchParams.get('status')

    let q = sb.from('assignments').select(`
      id, title, description, type, max_score, due_date, status, created_at,
      class_id, subject_id, teacher_id, school_id,
      class:classes(id, name, grade),
      subject:subjects(id, name, code, color),
      submissions:assignment_submissions(id, learner_id, score, status, submitted_at)
    `).order('due_date', { ascending: false })

    if (classId) {
      q = q.eq('class_id', classId)
    } else if (user.role === 'TEACHER') {
      q = q.eq('teacher_id', user.id)
    } else if (user.role === 'LEARNER') {
      // Learner sees assignments for their classes
      const { data: myClasses } = await sb.from('class_members')
        .select('class_id').eq('learner_id', user.id)
      const classIds = (myClasses || []).map((m: any) => m.class_id)
      if (classIds.length === 0) return NextResponse.json({ assignments: [] })
      q = q.in('class_id', classIds)
    } else if (user.role === 'SCHOOL_ADMIN') {
      q = q.eq('school_id', user.schoolId)
    }

    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ assignments: data || [] })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()
    const body = await req.json().catch(() => ({}))
    const { classId, title, description, subjectId, dueDate, maxScore, type } = body

    if (!classId || !title || !dueDate) {
      return NextResponse.json({ error: 'classId, title, and dueDate are required' }, { status: 400 })
    }

    // Verify class access
    const { data: cls } = await sb.from('classes')
      .select('id, school_id, teacher_id, grade').eq('id', classId).maybeSingle()
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
      if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await sb.from('assignments').insert({
      school_id: cls.school_id,
      class_id: classId,
      teacher_id: user.id,
      subject_id: subjectId || null,
      title: String(title).trim(),
      description: description || null,
      type: type || 'ASSIGNMENT',
      max_score: Number(maxScore) || 100,
      due_date: dueDate,
      status: 'PUBLISHED',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assignment: data }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
