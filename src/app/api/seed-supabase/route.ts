import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'
import { runSupabaseSeed } from '@/lib/seed-supabase'

// POST /api/seed-supabase — re-seed the Supabase database. Admin-only.
// If the database is already seeded, set ?force=1 to wipe & re-seed.
export async function POST(req: Request) {
  let user = null
  try { user = await getCurrentUser() } catch {}
  const sb = supabaseService()
  const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0 && (!user || user.role !== 'ADMIN')) {
    return NextResponse.json(
      { error: 'Unauthorized — admin only when DB is already seeded.' },
      { status: 403 }
    )
  }
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'
  if (force) {
    // Wipe in dependency order
    await sb.from('quiz_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('quiz_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('quiz_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('quiz_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('quizzes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('lesson_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('lesson_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('lessons').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('class_members').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('classes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('question_bank').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // Delete all auth users (so we can recreate fresh)
    const { data: profiles } = await sb.from('profiles').select('id')
    if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        await sb.auth.admin.deleteUser(p.id)
      }
    }
    console.log('Supabase database wiped.')
  }
  try {
    const result = await runSupabaseSeed()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('seed-supabase failed:', e)
    return NextResponse.json(
      { error: e?.message || 'Seed failed. Check that Supabase env vars are set and the schema has been applied.' },
      { status: 500 }
    )
  }
}
