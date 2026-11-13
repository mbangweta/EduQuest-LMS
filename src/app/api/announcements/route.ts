import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { auditLog } from '@/lib/audit'
import { supabaseService } from '@/lib/supabase'
import { notifySupabase } from '@/lib/notify-supabase'

// GET /api/announcements — list announcements visible to the current user.
// Super User: all. School Admin/Teacher/Learner: own school's + global.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = supabaseService()

  let q = sb.from('announcements').select(`
    id, author_id, school_id, audience, title, message, status, created_at,
    author:profiles!author_id(id, name, email, role, avatar_color),
    school:schools(id, name, code)
  `).order('created_at', { ascending: false })

  if (user.role !== 'SUPER_USER') {
    if (!user.schoolId) return NextResponse.json({ announcements: [] })
    // See own school's + global (school_id IS NULL)
    q = q.or(`school_id.eq.${user.schoolId},school_id.is.null`)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter by audience + role
  const filtered = (data || []).filter((a: any) => {
    const aud = a.audience
    if (aud === 'ALL') return true
    if (user.role === 'SUPER_USER') return true
    if (aud === 'SCHOOL_ADMIN' && user.role === 'SCHOOL_ADMIN') return true
    if (aud === 'TEACHER' && (user.role === 'TEACHER' || user.role === 'SCHOOL_ADMIN')) return true
    if (aud === 'LEARNER' && user.role === 'LEARNER') return true
    if (aud === 'ADMIN_AND_TEACHER' && (user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER')) return true
    if (aud === 'TEACHER_AND_LEARNER' && (user.role === 'TEACHER' || user.role === 'LEARNER')) return true
    return false
  })

  return NextResponse.json({ announcements: filtered })
}

// POST /api/announcements — create an announcement.
// Body: { title, message, audience, schoolId? }
// SUPER_USER: any audience, any school or global. SCHOOL_ADMIN: TEACHER|LEARNER|ADMIN_AND_TEACHER, own school. TEACHER: LEARNER only, own school.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden — learners cannot create announcements' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { title, message, audience, schoolId: requestedSchoolId } = body
  if (!title || !message) {
    return NextResponse.json({ error: 'title and message required' }, { status: 400 })
  }

  // Validate audience by role
  const allowedAudiences: Record<string, string[]> = {
    SUPER_USER: ['ALL', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER', 'ADMIN_AND_TEACHER', 'TEACHER_AND_LEARNER'],
    SCHOOL_ADMIN: ['TEACHER', 'LEARNER', 'ADMIN_AND_TEACHER', 'TEACHER_AND_LEARNER'],
    TEACHER: ['LEARNER'],
  }
  const aud = audience || (user.role === 'TEACHER' ? 'LEARNER' : 'ALL')
  if (!allowedAudiences[user.role]?.includes(aud)) {
    return NextResponse.json({ error: `You cannot create announcements for audience "${aud}"` }, { status: 403 })
  }

  // Resolve school_id
  let schoolId: string | null = null
  if (user.role === 'SUPER_USER') {
    schoolId = requestedSchoolId || null // null = global
  } else {
    if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    schoolId = user.schoolId
  }

  const sb = supabaseService()
  const { data, error } = await sb.from('announcements').insert({
    author_id: user.id,
    school_id: schoolId,
    audience: aud,
    title: String(title),
    message: String(message),
    status: 'ACTIVE',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send notifications to the target audience
  let notifUserIds: string[] = []
  if (schoolId) {
    let userQuery = sb.from('profiles').select('id').eq('school_id', schoolId).eq('status', 'ACTIVE')
    if (aud === 'SCHOOL_ADMIN') userQuery = userQuery.eq('role', 'SCHOOL_ADMIN')
    else if (aud === 'TEACHER') userQuery = userQuery.in('role', ['TEACHER'])
    else if (aud === 'LEARNER') userQuery = userQuery.eq('role', 'LEARNER')
    else if (aud === 'ADMIN_AND_TEACHER') userQuery = userQuery.in('role', ['SCHOOL_ADMIN', 'TEACHER'])
    else if (aud === 'TEACHER_AND_LEARNER') userQuery = userQuery.in('role', ['TEACHER', 'LEARNER'])
    // ALL = all users in school
    const { data: users } = await userQuery
    notifUserIds = (users || []).map((u: any) => u.id)
  } else {
    // Global — all users
    const { data: users } = await sb.from('profiles').select('id').eq('status', 'ACTIVE').neq('id', user.id)
    notifUserIds = (users || []).map((u: any) => u.id)
  }

  for (const uid of notifUserIds) {
    await notifySupabase(uid, {
      type: 'ANNOUNCEMENT',
      title: `Announcement: ${title}`,
      message: message.length > 100 ? message.slice(0, 100) + '...' : message,
      data: { announcementId: data.id },
    })
  }

  await auditLog({
    user, action: 'ANNOUNCEMENT_CREATE', entityType: 'announcement', entityId: data.id,
    description: `Created announcement "${title}" for audience ${aud}`,
    metadata: { audience: aud, notifiedUsers: notifUserIds.length },
  })

  return NextResponse.json({ announcement: data }, { status: 201 })
}
