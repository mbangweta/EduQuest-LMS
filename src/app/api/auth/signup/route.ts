import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

// POST /api/auth/signup — self-signup (learner only; teachers/admins must be
// created by an admin via /api/users). Body: { email, password, name, grade? }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, password, name, grade } = body
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'email, password and name are required' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }
    // Always create as LEARNER via public signup — prevents privilege escalation.
    const sb = await supabaseServer()
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'LEARNER', grade: grade ?? null },
      },
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ user: data.user }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Signup failed' }, { status: 500 })
  }
}
