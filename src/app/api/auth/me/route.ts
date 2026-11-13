import { NextResponse } from 'next/server'
import { supabaseConfigured } from '@/lib/supabase'

// GET /api/auth/me — returns the current user's role-enriched profile.
// Returns { user: null } when Supabase isn't configured.
// Also records last_login_at (once per ~5 minutes to avoid hot writes).
export async function GET() {
  if (!supabaseConfigured) {
    return NextResponse.json({ user: null })
  }
  try {
    const { getCurrentUser } = await import('@/lib/auth-supabase')
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ user: null })

    // Update last_login_at if it's older than 5 minutes (or never set)
    try {
      const { supabaseService } = await import('@/lib/supabase')
      const sb = supabaseService()
      const { data: profile } = await sb.from('profiles')
        .select('last_login_at')
        .eq('id', user.id)
        .maybeSingle()
      const lastLogin = profile?.last_login_at ? new Date(profile.last_login_at).getTime() : 0
      const fiveMinutes = 5 * 60 * 1000
      if (Date.now() - lastLogin > fiveMinutes) {
        await sb.from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id)
      }
    } catch (e) {
      // best-effort — don't fail the auth/me call
    }

    return NextResponse.json({ user })
  } catch (e: any) {
    console.error('[/api/auth/me]', e?.message)
    return NextResponse.json({ user: null })
  }
}
