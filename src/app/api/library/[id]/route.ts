import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// PATCH /api/library/[id] — update a library resource.
// SUPER_USER: any. SCHOOL_ADMIN: own school. TEACHER: own school + own upload.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const sb = supabaseService()

  // Fetch the resource to check ownership
  const { data: existing, error: fetchErr } = await sb.from('library_resources').select('school_id, uploaded_by_id').eq('id', id).single()
  if (fetchErr || !existing) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })

  if (user.role !== 'SUPER_USER') {
    if (existing.school_id !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden — cannot edit other schools' resources" }, { status: 403 })
    }
    if (user.role === 'TEACHER' && existing.uploaded_by_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden — you can only edit resources you uploaded' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const updates: any = {}
  for (const k of ['title', 'description', 'subject_id', 'grade', 'year', 'paper_type', 'file_url', 'file_type', 'file_size', 'status']) {
    if (body[k] !== undefined) updates[k] = body[k]
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

  const { data, error } = await sb.from('library_resources').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data })
}

// DELETE /api/library/[id] — delete a library resource.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const sb = supabaseService()

  const { data: existing } = await sb.from('library_resources').select('school_id, uploaded_by_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })

  if (user.role !== 'SUPER_USER') {
    if (existing.school_id !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden — cannot delete other schools' resources" }, { status: 403 })
    }
    if (user.role === 'TEACHER' && existing.uploaded_by_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden — you can only delete resources you uploaded' }, { status: 403 })
    }
  }

  const { error } = await sb.from('library_resources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
