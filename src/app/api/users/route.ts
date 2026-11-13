import { NextResponse } from 'next/server'
import { supabaseService, formatUser } from '@/lib/api-helpers'
import { adminCreateUser, adminCreateUserFromName, getCurrentUser, DEFAULT_USER_PASSWORD } from '@/lib/auth-supabase'
import { auditLog } from '@/lib/audit'

// GET /api/users — list users. SUPER_USER: all. SCHOOL_ADMIN: own school. TEACHER: own school's learners in their classes.
// Optional filters: role, grade, q, schoolId (super user only).
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sb = supabaseService()
    const url = new URL(req.url)
    const role = url.searchParams.get('role') || undefined
    const gradeStr = url.searchParams.get('grade')
    const grade = gradeStr ? Number(gradeStr) : undefined
    const q = url.searchParams.get('q') || undefined
    const schoolId = url.searchParams.get('schoolId')

    let query = sb.from('profiles').select(
      'id, name, email, role, phone, grade, status, avatar_color, school_id, created_at, last_login_at, school:schools(id, name, code)',
    ).order('created_at', { ascending: false })

    // Scope by role
    if (user.role === 'SUPER_USER') {
      if (schoolId) query = query.eq('school_id', schoolId)
      else if (schoolId === 'none') query = query.is('school_id', null)
    } else if (user.role === 'SCHOOL_ADMIN') {
      if (!user.schoolId) return NextResponse.json({ users: [] })
      query = query.eq('school_id', user.schoolId)
    } else {  // TEACHER
      if (!user.schoolId) return NextResponse.json({ users: [] })
      // Teachers see only learners in their school (RLS will further restrict to those in their classes, but for the listing UI we show all school learners; the school admin sees everything)
      query = query.eq('school_id', user.schoolId).in('role', ['LEARNER'])
    }

    if (role) query = query.eq('role', role)
    if (grade) query = query.eq('grade', grade)
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const users = (data || []).map((u: any) => ({
      ...formatUser(u),
      schoolId: u.school_id,
      school: u.school,
      lastLoginAt: u.last_login_at,
    }))
    return NextResponse.json({ users })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users — create a user.
// Two modes:
//   1. New flow (preferred): body has { firstName, lastName, role, grade?, phone?, schoolId? }
//      → email auto-generated as firstname.lastname@eduquest.zm, password = "eduquest123"
//   2. Legacy flow (bulk import / direct API): body has { name, email, password, role, ... }
//      → uses provided email + password directly
// SUPER_USER: any role, any school (or no school for SUPER_USER).
// SCHOOL_ADMIN: TEACHER / LEARNER / SCHOOL_ADMIN in own school.
// TEACHER: LEARNER only in own school.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { firstName, lastName, role, grade, phone, name, email, password, schoolId: requestedSchoolId } = body

    const finalRole = (role || 'LEARNER').toUpperCase() as any
    const validRoles = ['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER', 'ADMIN']
    if (!validRoles.includes(finalRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    // TEACHER cannot create teachers / admins
    if (user.role === 'TEACHER' && finalRole !== 'LEARNER') {
      return NextResponse.json({ error: 'Teachers can only create learner accounts' }, { status: 403 })
    }
    // SCHOOL_ADMIN cannot create SUPER_USER
    if (user.role === 'SCHOOL_ADMIN' && finalRole === 'SUPER_USER') {
      return NextResponse.json({ error: 'School admins cannot create super user accounts' }, { status: 403 })
    }
    // Only SUPER_USER can create SUPER_USER
    if (finalRole === 'SUPER_USER' && user.role !== 'SUPER_USER') {
      return NextResponse.json({ error: 'Only super users can create super user accounts' }, { status: 403 })
    }

    // Resolve target school_id
    let targetSchoolId: string | null = null
    if (finalRole === 'SUPER_USER') {
      targetSchoolId = null  // super user is platform-wide
    } else if (user.role === 'SUPER_USER') {
      targetSchoolId = requestedSchoolId ?? user.schoolId ?? null
    } else {
      if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        return NextResponse.json({ error: 'Forbidden — cannot create users in other schools' }, { status: 403 })
      }
      targetSchoolId = user.schoolId
    }

    const sb = supabaseService()
    let resultId: string
    let resultEmail: string
    let resultPassword: string | null = null
    let fullName: string

    if (firstName && lastName) {
      // New flow — auto-generate email + default password
      if (!firstName.trim() || !lastName.trim()) {
        return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
      }
      const res = await adminCreateUserFromName({
        firstName: String(firstName), lastName: String(lastName), role: finalRole,
        grade: finalRole === 'LEARNER' && grade ? Number(grade) : undefined,
        phone: phone ? String(phone) : undefined, schoolId: targetSchoolId,
      })
      if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 })
      resultId = res.id
      resultEmail = res.email
      resultPassword = res.password
      fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    } else if (name && email && password) {
      // Legacy flow — direct email + password (used by bulk import)
      const { data: existing } = await sb.from('profiles').select('id').eq('email', String(email).toLowerCase()).maybeSingle()
      if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      const res = await adminCreateUser({
        email: String(email).toLowerCase(), password: String(password), name: String(name), role: finalRole,
        grade: finalRole === 'LEARNER' && grade ? Number(grade) : undefined,
        phone: phone ? String(phone) : undefined, schoolId: targetSchoolId,
      })
      if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 })
      resultId = res.id
      resultEmail = String(email).toLowerCase()
      fullName = String(name)
    } else {
      return NextResponse.json({ error: 'Provide firstName + lastName (+ role), or name + email + password' }, { status: 400 })
    }

    const { data: profile, error } = await sb
      .from('profiles')
      .select('id, name, email, role, phone, grade, status, avatar_color, school_id, created_at, school:schools(id, name, code)')
      .eq('id', resultId)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auditLog({
      user, action: 'USER_CREATE', entityType: 'profile', entityId: resultId,
      description: `Created user ${fullName} (${resultEmail}) with role ${finalRole}`,
      schoolId: targetSchoolId,
      metadata: { email: resultEmail, role: finalRole, grade: profile.grade, autoGenerated: !!resultPassword },
    })

    return NextResponse.json({
      user: { ...formatUser(profile), schoolId: profile.school_id, school: profile.school },
      generatedEmail: resultPassword ? resultEmail : undefined,
      generatedPassword: resultPassword || undefined,
    }, { status: 201 })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
