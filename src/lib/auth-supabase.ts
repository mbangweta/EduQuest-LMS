import { supabaseService, supabaseServer, supabaseConfigured } from './supabase'

// ============================================================================
// EduQuest LMS — Supabase Auth helpers (replaces NextAuth credentials layer)
// ============================================================================
// Sessions are managed by Supabase Auth (JWT in cookies via @supabase/ssr).
// User profiles live in `public.profiles` (1:1 with `auth.users`).
// Role is stored on `profiles.role` (NOT in JWT claims — simpler + RLS-friendly).
// ============================================================================

export type Role = 'SUPER_USER' | 'ADMIN' | 'TEACHER' | 'LEARNER' | 'SCHOOL_ADMIN'
export type Status = 'ACTIVE' | 'DISABLED'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: Role
  status: Status
  grade?: number | null
  phone?: string | null
  avatarColor?: string | null
  schoolId?: string | null
  schoolName?: string | null
  schoolCode?: string | null
}

// ---------------------------------------------------------------------------
// getCurrentUser() — read the current user from the Supabase session cookie.
// Returns null if no session, or if the user is DISABLED.
// ---------------------------------------------------------------------------
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!supabaseConfigured) return null
  try {
    const sb = await supabaseServer()
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) return null

    // Fetch the profile row (contains role, grade, status, etc.)
    const { data: profile, error: pErr } = await supabaseService()
      .from('profiles')
      .select(`
        id, email, name, role, status, grade, phone, avatar_color, school_id,
        school:schools(id, name, code)
      `)
      .eq('id', user.id)
      .single()

    if (pErr || !profile) return null
    if (profile.status !== 'ACTIVE') return null

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role as Role,
      status: profile.status as Status,
      grade: profile.grade,
      phone: profile.phone,
      avatarColor: profile.avatar_color,
      schoolId: profile.school_id,
      schoolName: profile.school?.name ?? null,
      schoolCode: profile.school?.code ?? null,
    }
  } catch (e) {
    console.error('[getCurrentUser] error:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// requireRole(roles) — throw 401/403 if unauthorized. Used by API routes.
// ---------------------------------------------------------------------------
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

// ---------------------------------------------------------------------------
// requireSchoolContext — returns the school_id the current user can act within.
// - SUPER_USER: returns the requested `targetSchoolId` (or null to act platform-wide)
// - SCHOOL_ADMIN/TEACHER/LEARNER: returns their own school_id (ignores target)
// Use this in API routes that operate on school-scoped resources.
// ---------------------------------------------------------------------------
export async function requireSchoolContext(targetSchoolId?: string): Promise<{
  user: CurrentUser
  schoolId: string | null  // null = platform-wide (super user only)
}> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  if (user.role === 'SUPER_USER') {
    return { user, schoolId: targetSchoolId ?? user.schoolId ?? null }
  }
  // Non-super users: must have a school_id, and they can only act within it.
  if (!user.schoolId) {
    throw new Response(JSON.stringify({ error: 'No school assigned' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }
  if (targetSchoolId && targetSchoolId !== user.schoolId) {
    throw new Response(JSON.stringify({ error: 'Forbidden — cannot access other schools' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }
  return { user, schoolId: user.schoolId }
}

// ---------------------------------------------------------------------------
// Admin-create-user (used by the admin users view).
// Uses the service-role client to call auth.admin.createUser — bypasses the
// "user can't sign up another user" restriction. The handle_new_user trigger
// will create the matching profile row.
// ---------------------------------------------------------------------------
export async function adminCreateUser(opts: {
  email: string
  password: string
  name: string
  role: Role
  grade?: number
  phone?: string
  schoolId?: string | null  // null for SUPER_USER; school_id for everyone else
}): Promise<{ id: string } | { error: string }> {
  try {
    const sb = supabaseService()
    const { data, error } = await sb.auth.admin.createUser({
      email: opts.email,
      password: opts.password,
      email_confirm: true,  // skip email confirmation for demo
      user_metadata: {
        name: opts.name,
        role: opts.role,
      },
    })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Unknown error creating user' }

    // Update the profile row (created by the trigger) with extra fields
    const { error: updateErr } = await sb
      .from('profiles')
      .update({
        name: opts.name,
        role: opts.role,
        grade: opts.grade ?? null,
        phone: opts.phone ?? null,
        school_id: opts.schoolId ?? null,
        avatar_color: pickAvatarColor(opts.email),
      })
      .eq('id', data.user.id)
    if (updateErr) {
      // Profile row might not exist yet — insert it
      await sb.from('profiles').insert({
        id: data.user.id,
        email: opts.email,
        name: opts.name,
        role: opts.role,
        grade: opts.grade ?? null,
        phone: opts.phone ?? null,
        school_id: opts.schoolId ?? null,
      })
    }
    return { id: data.user.id }
  } catch (e: any) {
    return { error: e?.message || 'Failed to create user' }
  }
}

function pickAvatarColor(seed: string): string {
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#9333ea', '#0891b2', '#0d9488', '#7c3aed']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) | 0
  return colors[Math.abs(h) % colors.length]
}

// ---------------------------------------------------------------------------
// generateUniqueEmail — create a firstname.lastname@eduquest.zm email, handling
// duplicates by appending a number (e.g. thabo.mumba2@eduquest.zm).
// ---------------------------------------------------------------------------
export async function generateUniqueEmail(firstName: string, lastName: string): Promise<string> {
  const sb = supabaseService()
  const base = `${firstName}.${lastName}`.toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]/g, '')  // strip accents + special chars
    .replace(/\s+/g, '')
  const domain = 'eduquest.zm'
  let email = `${base}@${domain}`
  let suffix = 1
  // Check for duplicates and append a number if needed
  while (true) {
    const { data } = await sb.from('profiles').select('id').eq('email', email).maybeSingle()
    if (!data) break  // email is unique
    suffix++
    email = `${base}${suffix}@${domain}`
  }
  return email
}

// Default password for newly created users — they can change it after logging in.
export const DEFAULT_USER_PASSWORD = 'eduquest123'

// ---------------------------------------------------------------------------
// adminCreateUserFromName — convenience wrapper that takes firstName + lastName
// + role, auto-generates the email (firstname.lastname@eduquest.zm) and uses
// the default password. Used by the new "Add User" forms.
// ---------------------------------------------------------------------------
export async function adminCreateUserFromName(opts: {
  firstName: string
  lastName: string
  role: Role
  grade?: number
  phone?: string
  schoolId?: string | null
}): Promise<{ id: string; email: string; password: string } | { error: string }> {
  const email = await generateUniqueEmail(opts.firstName, opts.lastName)
  const password = DEFAULT_USER_PASSWORD
  const fullName = `${opts.firstName.trim()} ${opts.lastName.trim()}`.trim()
  const res = await adminCreateUser({
    email, password, name: fullName, role: opts.role,
    grade: opts.grade, phone: opts.phone, schoolId: opts.schoolId,
  })
  if ('error' in res) return res
  return { id: res.id, email, password }
}

// ---------------------------------------------------------------------------
// admin-delete-user — remove auth.users row; profile cascades via FK.
// ---------------------------------------------------------------------------
export async function adminDeleteUser(userId: string): Promise<{ error?: string }> {
  try {
    const sb = supabaseService()
    const { error } = await sb.auth.admin.deleteUser(userId)
    if (error) return { error: error.message }
    // The ON DELETE CASCADE on profiles will remove the profile row.
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete user' }
  }
}

// ---------------------------------------------------------------------------
// admin-update-user — update email, password, and profile fields.
// ---------------------------------------------------------------------------
export async function adminUpdateUser(
  userId: string,
  updates: {
    email?: string
    password?: string
    name?: string
    role?: Role
    grade?: number | null
    phone?: string | null
    status?: Status
    schoolId?: string | null
  },
): Promise<{ error?: string }> {
  try {
    const sb = supabaseService()
    if (updates.email || updates.password) {
      const adminUpdate: any = {}
      if (updates.email) adminUpdate.email = updates.email
      if (updates.password) adminUpdate.password = updates.password
      const { error: authErr } = await sb.auth.admin.updateUserById(userId, adminUpdate)
      if (authErr) return { error: authErr.message }
    }
    const profileUpdate: any = {}
    if (updates.name !== undefined) profileUpdate.name = updates.name
    if (updates.role !== undefined) profileUpdate.role = updates.role
    if (updates.grade !== undefined) profileUpdate.grade = updates.grade
    if (updates.phone !== undefined) profileUpdate.phone = updates.phone
    if (updates.status !== undefined) profileUpdate.status = updates.status
    if (updates.schoolId !== undefined) profileUpdate.school_id = updates.schoolId
    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await sb.from('profiles').update(profileUpdate).eq('id', userId)
      if (pErr) return { error: pErr.message }
    }
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update user' }
  }
}
