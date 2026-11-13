import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

async function patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const sb = supabaseService()
  const { data: existing } = await sb.from('academic_years').select('school_id').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role === 'SCHOOL_ADMIN' && existing.school_id !== user.schoolId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const updates: any = {}
  for (const k of ['name', 'start_date', 'end_date', 'is_current', 'status']) {
    if (body[k] !== undefined) updates[k] = body[k]
  }
  if (updates.is_current === true) {
    await sb.from('academic_years').update({ is_current: false }).eq('school_id', existing.school_id)
  }
  const { data, error } = await sb.from('academic_years').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ academicYear: data })
}

async function del(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const sb = supabaseService()
  const { data: existing } = await sb.from('academic_years').select('school_id').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role === 'SCHOOL_ADMIN' && existing.school_id !== user.schoolId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { error } = await sb.from('academic_years').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export const PATCH = patch
export const DELETE = del
