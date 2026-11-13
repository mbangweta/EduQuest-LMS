import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// GET /api/assessments/[id]/scores — return all scores for an assessment
// (along with the learner roster of the class, so the teacher can see who's missing).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const { id } = await params
    const sb = supabaseService()

    const { data: a, error } = await sb.from('assessments')
      .select('id, school_id, teacher_id, class_id, grade, subject_id, max_score, title, status')
      .eq('id', id).single()
    if (error || !a) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    if (user.role === 'TEACHER' && a.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && a.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Roster: if class_id is set, use class members; otherwise fall back to all learners
    // in the same school with matching grade. (Grade-wide assessment.)
    let roster: any[] = []
    if (a.class_id) {
      const { data: members } = await sb.from('class_members').select(`
        learner_id,
        learner:profiles(id, name, email, grade, avatar_color)
      `).eq('class_id', a.class_id)
      roster = (members || []).map((m: any) => m.learner).filter(Boolean)
    } else {
      const { data: learners } = await sb.from('profiles')
        .select('id, name, email, grade, avatar_color')
        .eq('role', 'LEARNER').eq('status', 'ACTIVE')
        .eq('school_id', a.school_id).eq('grade', a.grade)
      roster = learners || []
    }
    roster.sort((x: any, y: any) => (x.name || '').localeCompare(y.name || ''))

    // Scores
    const { data: scores } = await sb.from('assessment_scores').select(`
      id, assessment_id, learner_id, score, remarks, recorded_by, recorded_at, updated_at
    `).eq('assessment_id', id)
    const scoreMap = new Map<string, any>()
    for (const s of (scores || [])) scoreMap.set(s.learner_id, s)

    return NextResponse.json({
      assessment: {
        id: a.id,
        title: a.title,
        maxScore: a.max_score,
        status: a.status,
        classId: a.class_id,
        grade: a.grade,
        subjectId: a.subject_id,
      },
      roster,
      scores: Array.from(scoreMap.values()),
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/assessments/[id]/scores — bulk upsert scores for an assessment.
// Body: { scores: [{ learnerId, score, remarks? }] }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const { id } = await params
    const sb = supabaseService()

    const { data: a } = await sb.from('assessments')
      .select('id, school_id, teacher_id, max_score').eq('id', id).maybeSingle()
    if (!a) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    if (user.role === 'TEACHER' && a.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && a.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const incoming: Array<{ learnerId: string; score: number | null; remarks?: string }> = body.scores || []
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: 'scores must be an array' }, { status: 400 })
    }

    const maxScore = a.max_score
    const now = new Date().toISOString()

    // Fetch existing rows so we know whether to insert or update
    const { data: existing } = await sb.from('assessment_scores')
      .select('id, learner_id').eq('assessment_id', id)
    const existingMap = new Map<string, string>()
    for (const row of (existing || [])) existingMap.set(row.learner_id, row.id)

    const toInsert: any[] = []
    const toUpdate: any[] = []
    let invalid: string[] = []

    for (const entry of incoming) {
      if (!entry.learnerId) continue
      const score = entry.score === null || entry.score === undefined || entry.score === ''
        ? null
        : Number(entry.score)
      if (score !== null) {
        if (Number.isNaN(score)) {
          invalid.push(entry.learnerId)
          continue
        }
        if (score < 0 || score > maxScore) {
          invalid.push(entry.learnerId)
          continue
        }
      }
      const remarks = entry.remarks?.trim() || null
      const existingId = existingMap.get(entry.learnerId)
      if (existingId) {
        toUpdate.push({
          id: existingId,
          score,
          remarks,
          recorded_by: user.id,
          recorded_at: score !== null ? now : null,
        })
      } else {
        toInsert.push({
          assessment_id: id,
          learner_id: entry.learnerId,
          score,
          remarks,
          recorded_by: user.id,
          recorded_at: score !== null ? now : null,
        })
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await sb.from('assessment_scores').insert(toInsert)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
    for (const u of toUpdate) {
      const { error: updErr } = await sb.from('assessment_scores')
        .update({
          score: u.score,
          remarks: u.remarks,
          recorded_by: u.recorded_by,
          recorded_at: u.recorded_at,
        }).eq('id', u.id)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      inserted: toInsert.length,
      updated: toUpdate.length,
      invalid: invalid.length,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
