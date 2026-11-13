import { NextResponse } from 'next/server'
import { requireUser, supabaseService, formatUser } from '@/lib/api-helpers'
import { adminUpdateUser, adminDeleteUser } from '@/lib/auth-supabase'

// GET /api/users/[id] — fetch one. SUPER_USER / SCHOOL_ADMIN / ADMIN / self allowed.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const isPrivileged = ['SUPER_USER', 'SCHOOL_ADMIN', 'ADMIN'].includes(user.role)
    if (!isPrivileged && user.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const sb = supabaseService()
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, email, role, phone, grade, status, avatar_color, created_at, school_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // School admin can only read users in their own school
    if (user.role === 'SCHOOL_ADMIN' && data.school_id && data.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ user: formatUser(data) })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/users/[id] — update. SUPER_USER / SCHOOL_ADMIN / ADMIN (school-scoped) / self (own profile).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const isPrivileged = ['SUPER_USER', 'SCHOOL_ADMIN', 'ADMIN'].includes(user.role)

    if (!isPrivileged && user.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // School admin can only modify users in their own school
    if (user.role === 'SCHOOL_ADMIN') {
      const sb0 = supabaseService()
      const { data: target } = await sb0.from('profiles').select('id, school_id').eq('id', id).maybeSingle()
      if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (target.school_id && target.school_id !== user.schoolId) {
        return NextResponse.json({ error: 'Forbidden — cannot edit users in other schools' }, { status: 403 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const updates: any = {}
    if ('name' in body) updates.name = String(body.name)
    if ('phone' in body) updates.phone = body.phone ? String(body.phone) : null
    if ('avatarColor' in body) updates.avatarColor = body.avatarColor ? String(body.avatarColor) : null
    if ('grade' in body) updates.grade = body.grade ? Number(body.grade) : null
    if ('role' in body && isPrivileged) updates.role = String(body.role).toUpperCase()
    if ('status' in body && isPrivileged) updates.status = body.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'
    if ('schoolId' in body && (user.role === 'SUPER_USER' || user.role === 'ADMIN')) updates.schoolId = body.schoolId ? String(body.schoolId) : null
    if ('email' in body && body.email) updates.email = String(body.email).toLowerCase()
    if ('password' in body && body.password) updates.password = String(body.password)

    // Verify uniqueness of email if changed
    if (updates.email) {
      const sb = supabaseService()
      const { data: existing } = await sb.from('profiles').select('id').eq('email', updates.email).neq('id', id).maybeSingle()
      if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const r = await adminUpdateUser(id, updates)
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })

    const sb = supabaseService()
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, email, role, phone, grade, status, avatar_color, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ user: formatUser(data) })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/[id] — delete. SUPER_USER / SCHOOL_ADMIN (own school) / ADMIN.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'ADMIN'])
    const { id } = await ctx.params
    if (user.id === id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

    const sb = supabaseService()
    // School admin can only delete users in their own school
    if (user.role === 'SCHOOL_ADMIN') {
      const { data: target } = await sb.from('profiles').select('id, school_id').eq('id', id).maybeSingle()
      if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (target.school_id && target.school_id !== user.schoolId) {
        return NextResponse.json({ error: 'Forbidden — cannot delete users in other schools' }, { status: 403 })
      }
    }

    // Refuse to delete a teacher who still owns classes
    const { count } = await sb.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', id)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete a teacher who still owns classes' }, { status: 400 })
    }

    const r = await adminDeleteUser(id)
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
