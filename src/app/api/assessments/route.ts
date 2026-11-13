import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/assessments — list assessments visible to the current user.
// Query params: classId, subjectId, term, grade, status
export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const subjectId = url.searchParams.get('subjectId')
    const term = url.searchParams.get('term')
    const grade = url.searchParams.get('grade')
    const status = url.searchParams.get('status')

    let q = sb.from('assessments').select(`
      id, title, description, type, term, subject_id, grade, class_id, teacher_id,
      date, max_score, weight, status, academic_year_id, school_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name),
      class:classes(id, name, grade)
    `).order('date', { ascending: false })

    // Scope by role
    if (user.role === 'SUPER_USER') {
      // platform-wide
    } else if (user.schoolId) {
      q = q.eq('school_id', user.schoolId)
      if (user.role === 'TEACHER') {
        q = q.eq('teacher_id', user.id)
      } else if (user.role === 'LEARNER') {
        q = q.eq('status', 'PUBLISHED')
        const { data: myClasses } = await sb.from('class_members')
          .select('class_id').eq('learner_id', user.id)
        const classIds = (myClasses || []).map((m: any) => m.class_id)
        if (classIds.length > 0) {
          q = q.in('class_id', classIds)
        } else {
          return NextResponse.json({ assessments: [] })
        }
      }
    } else {
      return NextResponse.json({ assessments: [] })
    }

    if (classId) q = q.eq('class_id', classId)
    if (subjectId) q = q.eq('subject_id', subjectId)
    if (term) q = q.eq('term', Number(term))
    if (grade) q = q.eq('grade', Number(grade))
    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const assessments = (data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      type: a.type,
      term: a.term,
      subjectId: a.subject_id,
      subject: a.subject ? { id: a.subject.id, name: a.subject.name, code: a.subject.code, color: a.subject.color } : null,
      grade: a.grade,
      classId: a.class_id,
      className: a.class?.name,
      teacherId: a.teacher_id,
      teacherName: a.teacher?.name,
      date: a.date,
      maxScore: a.max_score,
      weight: Number(a.weight),
      status: a.status,
      academicYearId: a.academic_year_id,
      schoolId: a.school_id,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }))

    return NextResponse.json({ assessments })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/assessments — create a new assessment
// Assessments are created from within a class context, so classId and grade
// are required (inherited from the class). subjectId is optional (assessments
// for Grades 4-7 cover all subjects). weight is removed from the UI.
export async function POST(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    if (!user.schoolId && user.role !== 'SUPER_USER') {
      return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const {
      title, description, type, term, subjectId, grade, classId, date,
      maxScore, weight, status, academicYearId,
    } = body

    // classId and grade are required (inherited from the class context)
    if (!title || !classId || !grade) {
      return NextResponse.json({ error: 'title, classId, and grade are required' }, { status: 400 })
    }

    const sb = supabaseService()
    let schoolId = user.schoolId
    if (user.role === 'SUPER_USER' && body.schoolId) schoolId = body.schoolId

    // Fetch the class to verify authorization and inherit school_id + grade
    const { data: cls } = await sb.from('classes')
      .select('id, teacher_id, school_id, grade, name')
      .eq('id', classId).maybeSingle()
    if (!cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      // Check teacher_class_assignments
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
      if (!tca) {
        return NextResponse.json({ error: 'You can only create assessments for your own classes' }, { status: 403 })
      }
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden — class not in your school' }, { status: 403 })
    }
    schoolId = cls.school_id || user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with this class or your account. Please contact an administrator.' }, { status: 400 })
    }

    // Validate max score (must be 50, 100, or 150)
    const validMaxScores = [50, 100, 150]
    const maxScoreNum = Number(maxScore) || 100
    if (!validMaxScores.includes(maxScoreNum)) {
      return NextResponse.json({ error: 'maxScore must be 50, 100, or 150' }, { status: 400 })
    }

    const { data, error } = await sb.from('assessments').insert({
      school_id: schoolId,
      academic_year_id: academicYearId || null,
      title: String(title).trim(),
      description: description || null,
      type: type || 'FORTNIGHTLY',
      term: Number(term) || 1,
      subject_id: subjectId || null,  // optional — null means "all subjects"
      grade: Number(grade),
      class_id: classId,
      teacher_id: user.id,
      date: date || new Date().toISOString().slice(0, 10),
      max_score: maxScoreNum,
      weight: Number(weight) || 1.0,  // defaults to 1.0, not shown in UI
      status: status || 'DRAFT',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assessment: data }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
