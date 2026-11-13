import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/classes/[id]/conversations — list class conversations.
// Super User: any. School Admin: own school. Teacher: assigned classes. Learner: enrolled classes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = supabaseService()

  // Verify access
  const { data: cls } = await sb.from('classes').select('id, teacher_id, school_id').eq('id', id).maybeSingle()
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const hasAccess = user.role === 'SUPER_USER'
    || cls.teacher_id === user.id
    || (user.role === 'SCHOOL_ADMIN' && cls.school_id === user.schoolId)
    || false // check class membership below

  if (!hasAccess && user.role === 'LEARNER') {
    const { data: member } = await sb.from('class_members').select('id').eq('class_id', id).eq('learner_id', user.id).maybeSingle()
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (!hasAccess) {
    // Check teacher_class_assignments
    const { data: tca } = await sb.from('teacher_class_assignments').select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
    if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await sb.from('class_conversations').select(`
    id, class_id, title, created_by, pinned, created_at,
    created_by_user:profiles!created_by(id, name, avatar_color, role),
    _count:class_messages(id)
  `).eq('class_id', id).order('pinned', { ascending: false }).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversations: data || [] })
}

// POST /api/classes/[id]/conversations — start a new conversation.
// Any class member (teacher or learner) can start a conversation.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { title } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const sb = supabaseService()

  // Verify access (same as GET)
  const { data: cls } = await sb.from('classes').select('id, teacher_id, school_id').eq('id', id).maybeSingle()
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const isTeacher = cls.teacher_id === user.id
  const isSchoolAdmin = user.role === 'SCHOOL_ADMIN' && cls.school_id === user.schoolId
  const isSuper = user.role === 'SUPER_USER'
  let isMember = false
  if (!isTeacher && !isSchoolAdmin && !isSuper && user.role === 'LEARNER') {
    const { data: m } = await sb.from('class_members').select('id').eq('class_id', id).eq('learner_id', user.id).maybeSingle()
    isMember = !!m
  }
  if (!isTeacher && !isSchoolAdmin && !isSuper && !isMember) {
    // Check teacher_class_assignments
    const { data: tca } = await sb.from('teacher_class_assignments').select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
    if (!tca) return NextResponse.json({ error: 'Forbidden — you are not a member of this class' }, { status: 403 })
  }

  const { data, error } = await sb.from('class_conversations').insert({
    class_id: id,
    title: String(title),
    created_by: user.id,
    pinned: false,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversation: data }, { status: 201 })
}
