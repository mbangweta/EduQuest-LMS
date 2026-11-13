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

// POST /api/lessons/[id]/duplicate — create a copy as DRAFT
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: lesson, error: lErr } = await sb.from('lessons').select(`
      id, title, grade, subject_id, topic, objectives, notes, activities, examples,
      practice_questions, homework, summary, attachments, video_links
    `).eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user.role !== 'ADMIN') {
      // need to check teacher_id
      const { data: base } = await sb.from('lessons').select('teacher_id').eq('id', id).maybeSingle()
      if (!base || base.teacher_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: copy, error: insErr } = await sb.from('lessons').insert({
      title: `${lesson.title} (Copy)`,
      grade: lesson.grade,
      subject_id: lesson.subject_id,
      topic: lesson.topic,
      objectives: lesson.objectives,
      notes: lesson.notes,
      activities: lesson.activities,
      examples: lesson.examples,
      practice_questions: lesson.practice_questions,
      homework: lesson.homework,
      summary: lesson.summary,
      attachments: lesson.attachments,
      video_links: lesson.video_links,
      status: 'DRAFT',
      teacher_id: user.id,
    }).select(`
      id, title, grade, subject_id, topic, objectives, notes, activities, examples,
      practice_questions, homework, summary, attachments, video_links, status,
      teacher_id, created_at, updated_at,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name, email)
    `).single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ lesson: formatLessonRow(copy) }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
