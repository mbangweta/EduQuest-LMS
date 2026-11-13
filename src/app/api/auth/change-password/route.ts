import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseServer } from '@/lib/supabase'

// POST /api/auth/change-password — current user changes their own password.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { currentPassword, newPassword } = body
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword required' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
  }
  try {
    const sb = await supabaseServer()
    const { error: verifyErr } = await sb.auth.signInWithPassword({
      email: user.email, password: String(currentPassword),
    })
    if (verifyErr) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    const { error: updateErr } = await sb.auth.updateUser({ password: String(newPassword) })
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to change password' }, { status: 500 })
  }
}
