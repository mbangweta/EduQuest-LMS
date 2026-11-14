import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'

// ============================================================================
// GET /api/timetable?classId=...
//   Returns all timetable slots for a class.
//
// POST /api/timetable
//   Body: { classId, slots: [{ dayOfWeek, period, subjectId, startTime, endTime, teacherId? }] }
//   Bulk upserts slots for a class (replaces existing ones).
//
// dayOfWeek: 1=Monday ... 5=Friday (or 6=Saturday, 0=Sunday)
// period: 1, 2, 3, ... (first period, second period, etc.)
// ============================================================================

export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    // Verify access
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

    const { data: slots } = await sb.from('timetable_slots').select(`
      id, day_of_week, period, start_time, end_time, subject_id, teacher_id,
      subject:subjects(id, name, code, color),
      teacher:profiles(id, name)
    `).eq('class_id', classId)
    .order('day_of_week', { ascending: true })
    .order('period', { ascending: true })

    return NextResponse.json({ slots: slots || [] })
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
    const { classId, slots } = body

    if (!classId || !Array.isArray(slots)) {
      return NextResponse.json({ error: 'classId and slots[] are required' }, { status: 400 })
    }

    // Verify access
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

    // Delete existing slots for this class, then insert new ones
    await sb.from('timetable_slots').delete().eq('class_id', classId)

    const toInsert = slots
      .filter((s: any) => s.dayOfWeek != null && s.period != null)
      .map((s: any) => ({
        class_id: classId,
        school_id: cls.school_id,
        day_of_week: Number(s.dayOfWeek),
        period: Number(s.period),
        start_time: s.startTime || null,
        end_time: s.endTime || null,
        subject_id: s.subjectId || null,
        teacher_id: s.teacherId || cls.teacher_id,
      }))

    if (toInsert.length > 0) {
      const { error } = await sb.from('timetable_slots').insert(toInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, classId, saved: toInsert.length })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
