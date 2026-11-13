import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { notifySupabase } from '@/lib/notify-supabase'

// GET /api/classes/[id]/members — list the learners in a class.
// Used by the report-card pickers (teacher + school admin).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: cls, error: clsErr } = await sb.from('classes')
      .select('id, teacher_id, school_id').eq('id', id).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    // Permission
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      // Also check teacher_class_assignments
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
      if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'LEARNER') {
      const { data: m } = await sb.from('class_members')
        .select('id').eq('class_id', id).eq('learner_id', user.id).maybeSingle()
      if (!m) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: members, error } = await sb.from('class_members').select(`
      id, class_id, learner_id, enrolled_at,
      learner:profiles(id, name, email, grade, role, avatar_color)
    `).eq('class_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sort by name
    const list = (members || []).map((m: any) => ({
      id: m.id,
      classId: m.class_id,
      learnerId: m.learner_id,
      enrolledAt: m.enrolled_at,
      ...m.learner,
    })).filter((m: any) => m.role === 'LEARNER')
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))

    return NextResponse.json({ members: list })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/classes/[id]/members — add learner by email or userId
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, name, teacher_id').eq('id', id).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (user.role !== 'SUPER_USER' && user.role !== 'SCHOOL_ADMIN' && cls.teacher_id !== user.id) {
      // Also check teacher_class_assignments
      if (user.role === 'TEACHER') {
        const { data: tca } = await sb.from('teacher_class_assignments').select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
        if (!tca) return NextResponse.json({ error: 'Forbidden — you are not assigned to this class' }, { status: 403 })
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    const body = await req.json().catch(() => ({}))
    let learnerId: string | undefined = body.userId
    if (!learnerId && body.email) {
      const learnerEmail = String(body.email).toLowerCase()
      const { data: u, error: uErr } = await sb.from('profiles').select('id, role').eq('email', learnerEmail).maybeSingle()
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
      if (!u) return NextResponse.json({ error: 'No learner with that email' }, { status: 404 })
      if (u.role !== 'LEARNER') return NextResponse.json({ error: 'User is not a learner' }, { status: 400 })
      learnerId = u.id
    }
    if (!learnerId) return NextResponse.json({ error: 'email or userId required' }, { status: 400 })

    const { data: member, error: upErr } = await sb.from('class_members').upsert({
      class_id: id,
      learner_id: learnerId,
    }, { onConflict: 'class_id,learner_id' }).select(`
      id, class_id, learner_id, enrolled_at,
      learner:profiles(id, name, email, grade, avatar_color)
    `).single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    await notifySupabase(learnerId, {
      type: 'ANNOUNCEMENT',
      title: 'Added to a class',
      message: `You have been added to ${cls.name}.`,
      data: { classId: cls.id },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
