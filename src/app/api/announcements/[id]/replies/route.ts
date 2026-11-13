import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/announcements/[id]/replies — list replies for an announcement.
// Private replies are only visible to the announcement author and the reply author.
// Public replies are visible to everyone who can see the announcement.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = supabaseService()

  const { data, error } = await sb.from('announcement_replies').select(`
    id, announcement_id, author_id, message, is_private, reply_to_id, created_at,
    author:profiles!author_id(id, name, email, role, avatar_color)
  `).eq('announcement_id', id).order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter private replies — only the announcement author and the reply author can see them
  // First fetch the announcement to get the author_id
  const { data: announcement } = await sb.from('announcements').select('author_id').eq('id', id).maybeSingle()

  const filtered = (data || []).filter((r: any) => {
    if (!r.is_private) return true // public reply — visible to all
    // Private reply — only announcement author or reply author can see
    if (r.author_id === user.id) return true
    if (announcement?.author_id === user.id) return true
    return false
  })

  return NextResponse.json({ replies: filtered })
}

// POST /api/announcements/[id]/replies — create a reply.
// Body: { message, isPrivate?, replyToId? }
// Permission rules:
//   - Super User can reply to any announcement
//   - School Admin can reply (privately) to Super User announcements + reply to their own
//   - Teachers can reply (privately) to School Admin announcements + reply to their own
//   - Learners can reply to Teacher announcements (publicly)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { message, isPrivate, replyToId } = body
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const sb = supabaseService()

  // Fetch the announcement to check permissions
  const { data: announcement, error: annErr } = await sb.from('announcements')
    .select('id, author_id, audience, school_id')
    .eq('id', id).maybeSingle()
  if (annErr || !announcement) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })

  // Determine if the user can reply to this announcement
  const authorRole = await sb.from('profiles').select('role').eq('id', announcement.author_id).maybeSingle()
  const annAuthorRole = authorRole.data?.role

  const canReply = (() => {
    if (user.role === 'SUPER_USER') return true
    // If the user is in the audience, they can reply
    const aud = announcement.audience
    if (aud === 'ALL') return true
    if (aud === 'SCHOOL_ADMIN' && user.role === 'SCHOOL_ADMIN') return true
    if (aud === 'TEACHER' && (user.role === 'TEACHER' || user.role === 'SCHOOL_ADMIN')) return true
    if (aud === 'LEARNER' && user.role === 'LEARNER') return true
    if (aud === 'ADMIN_AND_TEACHER' && (user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER')) return true
    if (aud === 'TEACHER_AND_LEARNER' && (user.role === 'TEACHER' || user.role === 'LEARNER')) return true
    // Same school
    if (announcement.school_id && user.schoolId === announcement.school_id) return true
    return false
  })()

  if (!canReply) return NextResponse.json({ error: 'You cannot reply to this announcement' }, { status: 403 })

  const { data, error } = await sb.from('announcement_replies').insert({
    announcement_id: id,
    author_id: user.id,
    message: String(message),
    is_private: !!isPrivate,
    reply_to_id: replyToId || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the announcement author about the reply
  if (announcement.author_id !== user.id) {
    await supabaseService().from('notifications').insert({
      user_id: announcement.author_id,
      type: 'ANNOUNCEMENT',
      title: 'New reply to your announcement',
      message: `${user.name} replied to your announcement`,
      data: { announcementId: id, replyId: data.id, isPrivate: !!isPrivate },
    })
  }

  return NextResponse.json({ reply: data }, { status: 201 })
}
