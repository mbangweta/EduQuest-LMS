import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

function formatLessonRow(l: any) {
  return {
    id: l.id,
    title: l.title,
    grade: l.grade,
    subjectId: l.subject?.id ?? l.subject_id,
    subject: l.subject ? {
      id: l.subject.id, name: l.subject.name,
      code: l.subject.code, color: l.subject.color,
    } : undefined,
    topic: l.topic,
    objectives: l.objectives,
    notes: l.notes,
    activities: l.activities,
    examples: l.examples,
    practiceQuestions: l.practice_questions,
    homework: l.homework,
    summary: l.summary,
    attachments: l.attachments,
    videoLinks: l.video_links,
    status: l.status,
    teacherId: l.teacher_id,
    teacher: l.teacher ? {
      id: l.teacher.id, name: l.teacher.name,
      email: l.teacher.email, avatarColor: l.teacher.avatar_color,
    } : undefined,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }
}

// GET /api/lessons — list lessons scoped by role.
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const sb = supabaseService()

    const url = new URL(req.url)
    const gradeStr = url.searchParams.get('grade')
    const subjectId = url.searchParams.get('subjectId') || undefined
    const status = url.searchParams.get('status') || undefined
    const q = url.searchParams.get('q') || undefined

    let lessonIds: string[] | null = null
    if (user.role === 'LEARNER') {
      // Lessons assigned to one of my classes, distinct, PUBLISHED only
      const { data: myMembers } = await sb.from('class_members').select('class_id').eq('learner_id', user.id)
      const myClassIds = (myMembers || []).map((m: any) => m.class_id)
      if (myClassIds.length === 0) return NextResponse.json({ lessons: [] })
      const { data: assigns } = await sb.from('lesson_assignments').select('lesson_id').in('class_id', myClassIds)
      lessonIds = Array.from(new Set((assigns || []).map((a: any) => a.lesson_id)))
      if (lessonIds.length === 0) return NextResponse.json({ lessons: [] })
    }

    let query = sb.from('lessons').select(`
      id, title, grade, subject_id, topic, objectives, notes, activities, examples,
      practice_questions, homework, summary, attachments, video_links, status,
      teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color)
    `)
    if (user.role === 'TEACHER') query = query.eq('teacher_id', user.id)
    else if (user.role === 'LEARNER') {
      query = query.in('id', lessonIds!).eq('status', 'PUBLISHED')
    }
    if (gradeStr) query = query.eq('grade', Number(gradeStr))
    if (subjectId) query = query.eq('subject_id', subjectId)
    if (status) query = query.eq('status', status)
    if (q) query = query.or(`title.ilike.%${q}%,topic.ilike.%${q}%`)
    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const lessons = await Promise.all((data || []).map(async (l: any) => {
      const [a, p] = await Promise.all([
        sb.from('lesson_assignments').select('id', { count: 'exact', head: true }).eq('lesson_id', l.id),
        sb.from('lesson_progress').select('id', { count: 'exact', head: true }).eq('lesson_id', l.id),
      ])
      return { ...formatLessonRow(l), _count: { assignments: a.count ?? 0, progress: p.count ?? 0 } }
    }))
    return NextResponse.json({ lessons })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/lessons — create (teacher/admin)
export async function POST(req: Request) {
  try {
    const user = await requireUser(['TEACHER', 'ADMIN'])
    const sb = supabaseService()

    const body = await req.json().catch(() => ({}))
    const {
      title, grade, subjectId, topic, status, objectives, notes, activities, examples,
      practiceQuestions, homework, summary, attachments, videoLinks,
    } = body
    if (!title || !grade || !subjectId || !topic) {
      return NextResponse.json({ error: 'title, grade, subjectId, topic are required' }, { status: 400 })
    }
    const { data: created, error } = await sb.from('lessons').insert({
      title: String(title),
      grade: Number(grade),
      subject_id: String(subjectId),
      topic: String(topic),
      objectives: objectives ?? '',
      notes: notes ?? '',
      activities: activities ?? null,
      examples: examples ?? null,
      practice_questions: practiceQuestions ?? null,
      homework: homework ?? null,
      summary: summary ?? null,
      attachments: attachments ?? null,
      video_links: videoLinks ?? null,
      status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      teacher_id: user.id,
    }).select(`
      id, title, grade, subject_id, topic, objectives, notes, activities, examples,
      practice_questions, homework, summary, attachments, video_links, status,
      teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email, avatar_color)
    `).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ lesson: formatLessonRow(created) }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
