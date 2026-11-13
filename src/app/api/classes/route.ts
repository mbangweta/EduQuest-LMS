import { NextResponse } from 'next/server'
import { requireUser, supabaseService, generateClassCode } from '@/lib/api-helpers'
import { PERSONAL_MAX_CLASSES } from '@/lib/auth-supabase'

// Format a class row + counts for the API response (preserves Prisma shape).
async function formatClassRow(sb: ReturnType<typeof supabaseService>, c: any) {
  const [m, l, q] = await Promise.all([
    sb.from('class_members').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
    sb.from('lesson_assignments').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
    sb.from('quiz_assignments').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
  ])
  return {
    id: c.id,
    name: c.name,
    grade: c.grade,
    subjectId: c.subject?.id ?? c.subject_id,
    subject: c.subject ? {
      id: c.subject.id, name: c.subject.name,
      code: c.subject.code, color: c.subject.color,
    } : undefined,
    description: c.description,
    classCode: c.class_code,
    teacherId: c.teacher_id,
    teacher: c.teacher ? {
      id: c.teacher.id, name: c.teacher.name,
      email: c.teacher.email, avatarColor: c.teacher.avatar_color,
    } : undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    _count: {
      members: m.count ?? 0,
      lessonAssignments: l.count ?? 0,
      quizAssignments: q.count ?? 0,
    },
  }
}

// GET /api/classes — list classes scoped to role.
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const sb = supabaseService()

    const url = new URL(req.url)
    const gradeStr = url.searchParams.get('grade')
    const grade = gradeStr ? Number(gradeStr) : undefined

    let classIds: string[] | null = null
    if (user.role === 'LEARNER') {
      const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
      classIds = (myMembers || []).map((m: any) => m.class_id)
    }

    let query = sb.from('classes').select(`
      id, name, grade, subject_id, description, class_code, teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color)
    `)
    if (user.role === 'TEACHER') query = query.eq('teacher_id', user.id)
    else if (user.role === 'LEARNER') {
      if (!classIds || classIds.length === 0) return NextResponse.json({ classes: [] })
      query = query.in('id', classIds)
    }
    if (grade) query = query.eq('grade', grade)
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const classes = await Promise.all((data || []).map((c: any) => formatClassRow(sb, c)))
    return NextResponse.json({ classes })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/classes — create (teacher / school-admin / super-user / admin)
// For Grades 4-7, subjectId is optional (these grades learn all subjects).
// For Grade 8+, subjectId is required.
export async function POST(req: Request) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN', 'SUPER_USER', 'SCHOOL_ADMIN'])
    const sb = supabaseService()

    // Personal-account limit: max 3 classes total
    if (user.institutionType === 'PERSONAL') {
      const { count } = await sb.from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', user.id)
      if ((count ?? 0) >= PERSONAL_MAX_CLASSES) {
        return NextResponse.json(
          { error: `Individual teacher accounts are limited to ${PERSONAL_MAX_CLASSES} classes. You already have ${count}. Upgrade to a School account to create more.` },
          { status: 403 },
        )
      }
    }

    const body = await req.json().catch(() => ({}))
    const { name, grade, subjectId, description } = body
    if (!name || !grade) {
      return NextResponse.json({ error: 'name and grade are required' }, { status: 400 })
    }

    const gradeNum = Number(grade)
    // Grades 4-7 learn ALL subjects — subject is optional.
    // Grade 8+ still requires a subject.
    const subjectOptional = gradeNum <= 7
    if (!subjectOptional && !subjectId) {
      return NextResponse.json({ error: 'subjectId is required for Grade 8 and above' }, { status: 400 })
    }

    // Validate the subject if one was provided
    let subjectCode = 'ALL'
    if (subjectId) {
      const { data: subject, error: subjErr } = await sb.from('subjects').select('id, code').eq('id', subjectId).maybeSingle()
      if (subjErr) return NextResponse.json({ error: subjErr.message }, { status: 500 })
      if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 400 })
      subjectCode = subject.code
    }

    // Generate a unique class code
    const year = new Date().getFullYear()
    let classCode = generateClassCode(gradeNum, subjectCode, year)
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: exists } = await sb.from('classes').select('id').eq('class_code', classCode).maybeSingle()
      if (!exists) break
      classCode = generateClassCode(gradeNum, subjectCode, year)
    }

    const { data: created, error: insErr } = await sb.from('classes').insert({
      name: String(name),
      grade: gradeNum,
      subject_id: subjectId ? String(subjectId) : null,
      description: description ? String(description) : null,
      class_code: classCode,
      teacher_id: user.id,
      school_id: user.schoolId,  // associate the class with the creator's school
    }).select(`
      id, name, grade, subject_id, description, class_code, teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color)
    `).single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    const cls = await formatClassRow(sb, created)
    return NextResponse.json({ class: cls }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
