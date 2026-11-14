import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// ============================================================================
// POST /api/assignments/[id]/submit
//   Learner submits their assignment. Body: { content } (text submission).
//   Sets submission status to 'SUBMITTED'.
//
// PUT /api/assignments/[id]/submit
//   Teacher grades a submission. Body: { learnerId, score, feedback }
//   Sets submission status to 'GRADED'.
// ============================================================================

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['LEARNER', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_USER'])
    const sb = supabaseService()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { content, learnerId } = body

    // For learners, use their own ID. For teachers/admins submitting on behalf,
    // use the provided learnerId.
    const targetLearnerId = user.role === 'LEARNER' ? user.id : learnerId
    if (!targetLearnerId) {
      return NextResponse.json({ error: 'learnerId is required' }, { status: 400 })
    }

    // Verify the assignment exists and the learner is enrolled in the class
    const { data: assignment } = await sb.from('assignments')
      .select('id, class_id, due_date, max_score, status').eq('id', id).maybeSingle()
    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    if (user.role === 'LEARNER') {
      const { data: member } = await sb.from('class_members')
        .select('id').eq('class_id', assignment.class_id).eq('learner_id', user.id).maybeSingle()
      if (!member) return NextResponse.json({ error: 'You are not enrolled in this class' }, { status: 403 })
    }

    // Check for existing submission
    const { data: existing } = await sb.from('assignment_submissions')
      .select('id, status').eq('assignment_id', id).eq('learner_id', targetLearnerId).maybeSingle()

    const now = new Date().toISOString()
    const isLate = assignment.due_date ? new Date(now) > new Date(assignment.due_date) : false

    if (existing) {
      // Update existing submission
      const { data, error } = await sb.from('assignment_submissions').update({
        content: content || null,
        status: 'SUBMITTED',
        submitted_at: now,
      }).eq('id', existing.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ submission: data })
    }

    // Create new submission
    const { data, error } = await sb.from('assignment_submissions').insert({
      assignment_id: id,
      learner_id: targetLearnerId,
      class_id: assignment.class_id,
      content: content || null,
      status: isLate ? 'LATE' : 'SUBMITTED',
      submitted_at: now,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submission: data }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT — teacher grades a submission
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['TEACHER', 'SCHOOL_ADMIN', 'SUPER_USER'])
    const sb = supabaseService()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { learnerId, score, feedback } = body

    if (!learnerId) return NextResponse.json({ error: 'learnerId is required' }, { status: 400 })

    // Verify assignment + access
    const { data: assignment } = await sb.from('assignments')
      .select('id, teacher_id, school_id, max_score').eq('id', id).maybeSingle()
    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    if (user.role === 'TEACHER' && assignment.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && assignment.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scoreNum = score === null || score === undefined ? null : Number(score)
    if (scoreNum !== null && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > assignment.max_score)) {
      return NextResponse.json({ error: `Score must be between 0 and ${assignment.max_score}` }, { status: 400 })
    }

    // Find the submission
    const { data: existing } = await sb.from('assignment_submissions')
      .select('id').eq('assignment_id', id).eq('learner_id', learnerId).maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'No submission found for this learner' }, { status: 404 })
    }

    const { data, error } = await sb.from('assignment_submissions').update({
      score: scoreNum,
      feedback: feedback?.trim() || null,
      status: 'GRADED',
      graded_at: new Date().toISOString(),
      graded_by: user.id,
    }).eq('id', existing.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submission: data })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
