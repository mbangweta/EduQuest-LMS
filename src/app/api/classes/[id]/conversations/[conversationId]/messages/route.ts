import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/classes/[id]/conversations/[conversationId]/messages — list messages in a conversation.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; conversationId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, conversationId } = await params
  const sb = supabaseService()

  // Verify access to this class
  const { data: conv } = await sb.from('class_conversations').select('class_id').eq('id', conversationId).maybeSingle()
  if (!conv || conv.class_id !== id) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: cls } = await sb.from('classes').select('id, teacher_id, school_id').eq('id', id).maybeSingle()
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  // Check access
  const hasAccess = user.role === 'SUPER_USER'
    || cls.teacher_id === user.id
    || (user.role === 'SCHOOL_ADMIN' && cls.school_id === user.schoolId)
  if (!hasAccess) {
    // Check membership
    const { data: m } = await sb.from('class_members').select('id').eq('class_id', id).eq('learner_id', user.id).maybeSingle()
    const { data: tca } = await sb.from('teacher_class_assignments').select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
    if (!m && !tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await sb.from('class_messages').select(`
    id, conversation_id, author_id, message, created_at,
    author:profiles!author_id(id, name, avatar_color, role)
  `).eq('conversation_id', conversationId).order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data || [] })
}

// POST /api/classes/[id]/conversations/[conversationId]/messages — send a message.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; conversationId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, conversationId } = await params
  const body = await req.json().catch(() => ({}))
  const { message } = body
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const sb = supabaseService()

  // Verify access (same as GET)
  const { data: cls } = await sb.from('classes').select('id, teacher_id, school_id').eq('id', id).maybeSingle()
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const hasAccess = user.role === 'SUPER_USER'
    || cls.teacher_id === user.id
    || (user.role === 'SCHOOL_ADMIN' && cls.school_id === user.schoolId)
  if (!hasAccess) {
    const { data: m } = await sb.from('class_members').select('id').eq('class_id', id).eq('learner_id', user.id).maybeSingle()
    const { data: tca } = await sb.from('teacher_class_assignments').select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
    if (!m && !tca) return NextResponse.json({ error: 'Forbidden — you are not a member of this class' }, { status: 403 })
  }

  const { data, error } = await sb.from('class_messages').insert({
    conversation_id: conversationId,
    author_id: user.id,
    message: String(message),
  }).select(`
    id, conversation_id, author_id, message, created_at,
    author:profiles!author_id(id, name, avatar_color, role)
  `).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify class members about the new message (best effort, limit to 50)
  const { data: members } = await sb.from('class_members').select('learner_id').eq('class_id', id).limit(50)
  const teacherNotif = cls.teacher_id !== user.id ? [cls.teacher_id] : []
  const allRecipients = [...teacherNotif, ...(members || []).map((m: any) => m.learner_id)].filter((uid: string) => uid !== user.id)

  for (const uid of allRecipients.slice(0, 50)) {
    await sb.from('notifications').insert({
      user_id: uid,
      type: 'ANNOUNCEMENT',
      title: `New message in class chat`,
      message: `${user.name}: ${message.length > 80 ? message.slice(0, 80) + '...' : message}`,
      data: { classId: id, conversationId },
    })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
