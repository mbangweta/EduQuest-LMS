import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/schools/[id] — fetch one school. SUPER_USER: any. Others: their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (user.role !== 'SUPER_USER' && user.schoolId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const sb = supabaseService()
  const { data, error } = await sb.from('schools').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ school: data })
}

// PATCH /api/schools/[id] — update a school.
// SUPER_USER: any. SCHOOL_ADMIN: own school only, cannot change the code.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (user.role === 'SCHOOL_ADMIN') {
    if (user.schoolId !== id) {
      return NextResponse.json({ error: 'Forbidden — you can only update your own school' }, { status: 403 })
    }
  } else if (user.role !== 'SUPER_USER') {
    return NextResponse.json({ error: 'Forbidden — super user or school admin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const updates: any = {}
  // School admins cannot change the code
  const allowedFields = user.role === 'SUPER_USER'
    ? ['name', 'code', 'address', 'phone', 'email', 'status', 'motto', 'website', 'logo_url']
    : ['name', 'address', 'phone', 'email', 'motto', 'website', 'logo_url']
  for (const k of allowedFields) {
    if (body[k] !== undefined) updates[k] = body[k]
  }
  if (updates.code) updates.code = String(updates.code).toUpperCase()
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

  const sb = supabaseService()
  const { data, error } = await sb.from('schools').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ school: data })
}

// DELETE /api/schools/[id] — delete a school. SUPER_USER only.
// Refuses if the school still has users (must reassign or delete users first).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'SUPER_USER') {
    return NextResponse.json({ error: 'Forbidden — super user only' }, { status: 403 })
  }
  const { id } = await params
  const sb = supabaseService()

  // Check no users are still assigned
  const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', id)
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete school — ${count} users are still assigned. Reassign or delete them first.` },
      { status: 409 }
    )
  }

  const { error } = await sb.from('schools').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
