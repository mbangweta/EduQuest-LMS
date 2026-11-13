import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

// POST /api/auth/signout — clear the Supabase session cookie.
export async function POST() {
  try {
    const sb = await supabaseServer()
    await sb.auth.signOut()
  } catch {}
  return NextResponse.json({ ok: true })
}
