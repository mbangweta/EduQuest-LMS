import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { notifySupabase } from '@/lib/notify-supabase'

// POST /api/classes/join — learner joins by class code
export async function POST(req: Request) {
  try {
    const user = await requireUser(['LEARNER'])
    const sb = supabaseService()

    const body = await req.json().catch(() => ({}))
    const code = String(body.classCode || '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'classCode required' }, { status: 400 })

    const { data: cls, error: clsErr } = await sb.from('classes').select('id, name, teacher_id, grade, subject_id, description, class_code, created_at, updated_at').eq('class_code', code).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Invalid class code' }, { status: 404 })

    const { data: member, error: upErr } = await sb.from('class_members').upsert({
      class_id: cls.id,
      learner_id: user.id,
    }, { onConflict: 'class_id,learner_id' }).select('id, class_id, learner_id, enrolled_at').single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    await notifySupabase(cls.teacher_id, {
      type: 'ANNOUNCEMENT',
      title: 'New learner joined your class',
      message: `${user.name} joined ${cls.name} using the class code.`,
      data: { classId: cls.id, learnerId: user.id },
    })

    // Format cls to match Prisma shape (camelCase)
    const formatted = {
      id: cls.id, name: cls.name, grade: cls.grade, subjectId: cls.subject_id,
      description: cls.description, classCode: cls.class_code, teacherId: cls.teacher_id,
      createdAt: cls.created_at, updatedAt: cls.updated_at,
    }
    return NextResponse.json({ class: formatted, member }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
