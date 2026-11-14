import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// ============================================================================
// GET /api/attendance?classId=...&date=YYYY-MM-DD
//   Returns the attendance records for a class on a specific date.
//   If no date is given, returns today's attendance.
//
// POST /api/attendance
//   Body: { classId, date, records: [{ learnerId, status, notes? }] }
//   status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
//   Upserts all records for that class+date.
// ============================================================================

export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    // Verify class access
    const { data: cls } = await sb.from('classes')
      .select('id, school_id, teacher_id')
      .eq('id', classId).maybeSingle()
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
      if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch attendance records for this class+date
    const { data: records } = await sb.from('attendance')
      .select('id, learner_id, status, notes, recorded_by, recorded_at')
      .eq('class_id', classId)
      .eq('date', date)

    // Fetch the class roster (learner names)
    const { data: members } = await sb.from('class_members').select(`
      learner_id,
      learner:profiles(id, name, avatar_color)
    `).eq('class_id', classId)
    const roster = (members || []).map((m: any) => m.learner).filter(Boolean)

    // Merge: for each learner, find their attendance record (if any)
    const recordMap = new Map<string, any>()
    for (const r of (records || [])) recordMap.set(r.learner_id, r)
    const merged = roster.map((learner: any) => ({
      learnerId: learner.id,
      learnerName: learner.name,
      avatarColor: learner.avatar_color,
      status: recordMap.get(learner.id)?.status || 'UNMARKED',
      notes: recordMap.get(learner.id)?.notes || '',
      recordId: recordMap.get(learner.id)?.id || null,
    }))

    return NextResponse.json({
      classId,
      date,
      records: merged,
      summary: {
        present: merged.filter((m: any) => m.status === 'PRESENT').length,
        absent: merged.filter((m: any) => m.status === 'ABSENT').length,
        late: merged.filter((m: any) => m.status === 'LATE').length,
        excused: merged.filter((m: any) => m.status === 'EXCUSED').length,
        unmarked: merged.filter((m: any) => m.status === 'UNMARKED').length,
        total: merged.length,
      },
    })
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
    const { classId, date, records } = body

    if (!classId || !date || !Array.isArray(records)) {
      return NextResponse.json({ error: 'classId, date, and records[] are required' }, { status: 400 })
    }

    // Verify class access
    const { data: cls } = await sb.from('classes')
      .select('id, school_id, teacher_id').eq('id', classId).maybeSingle()
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
      if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch existing records for this class+date
    const { data: existing } = await sb.from('attendance')
      .select('id, learner_id').eq('class_id', classId).eq('date', date)
    const existingMap = new Map<string, string>()
    for (const r of (existing || [])) existingMap.set(r.learner_id, r.id)

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']
    const toInsert: any[] = []
    const toUpdate: any[] = []
    let skipped = 0

    for (const r of records) {
      if (!r.learnerId) { skipped++; continue }
      const status = String(r.status || '').toUpperCase()
      if (!validStatuses.includes(status)) { skipped++; continue }
      const notes = r.notes?.trim() || null
      const existingId = existingMap.get(r.learnerId)
      if (existingId) {
        toUpdate.push({
          id: existingId,
          status,
          notes,
          recorded_by: user.id,
          recorded_at: new Date().toISOString(),
        })
      } else {
        toInsert.push({
          class_id: classId,
          learner_id: r.learnerId,
          date,
          status,
          notes,
          recorded_by: user.id,
          recorded_at: new Date().toISOString(),
          school_id: cls.school_id,
        })
      }
    }

    let inserted = 0, updated = 0
    if (toInsert.length > 0) {
      const { error: insErr } = await sb.from('attendance').insert(toInsert)
      if (!insErr) inserted = toInsert.length
    }
    for (const u of toUpdate) {
      const { error: updErr } = await sb.from('attendance')
        .update({ status: u.status, notes: u.notes, recorded_by: u.recorded_by, recorded_at: u.recorded_at })
        .eq('id', u.id)
      if (!updErr) updated++
    }

    return NextResponse.json({
      ok: true,
      classId,
      date,
      inserted,
      updated,
      skipped,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// GET attendance stats for a learner (for the analytics dashboard)
export async function getLearnerAttendanceStats(sb: any, learnerId: string): Promise<{
  present: number; absent: number; late: number; excused: number; total: number; rate: number | null
}> {
  const { data } = await sb.from('attendance')
    .select('status').eq('learner_id', learnerId)
  const records = data || []
  const present = records.filter((r: any) => r.status === 'PRESENT').length
  const absent = records.filter((r: any) => r.status === 'ABSENT').length
  const late = records.filter((r: any) => r.status === 'LATE').length
  const excused = records.filter((r: any) => r.status === 'EXCUSED').length
  const total = records.length
  const rate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : null
  return { present, absent, late, excused, total, rate }
}
