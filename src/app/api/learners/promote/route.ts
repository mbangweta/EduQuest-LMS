import { NextResponse } from 'next/server'
import { getCurrentUser, adminUpdateUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// POST /api/learners/promote — bulk-promote learners from Grade N to Grade N+1.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const fromGrade = body.fromGrade !== undefined ? Number(body.fromGrade) : null
  const maxGrade = body.maxGrade !== undefined ? Number(body.maxGrade) : 12
  const dryRun = !!body.dryRun

  let schoolId: string | null
  if (user.role === 'SUPER_USER') {
    schoolId = body.schoolId ?? user.schoolId ?? null
    if (!schoolId) return NextResponse.json({ error: 'schoolId is required' }, { status: 400 })
  } else {
    if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    if (body.schoolId && body.schoolId !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    schoolId = user.schoolId
  }

  const sb = supabaseService()
  let q = sb.from('profiles').select('id, name, email, grade, status').eq('role', 'LEARNER').eq('school_id', schoolId)
  if (fromGrade !== null) q = q.eq('grade', fromGrade)
  const { data: learners, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const promoted: any[] = []
  const graduated: any[] = []
  const skipped: any[] = []

  for (const l of learners || []) {
    if (l.grade === null || l.grade === undefined) {
      skipped.push({ id: l.id, name: l.name, reason: 'No grade set' })
      continue
    }
    if (l.grade >= maxGrade) {
      graduated.push({ id: l.id, name: l.name, grade: l.grade })
      continue
    }
    const newGrade = l.grade + 1
    if (!dryRun) {
      const r = await adminUpdateUser(l.id, { grade: newGrade })
      if ('error' in r) {
        skipped.push({ id: l.id, name: l.name, reason: r.error })
        continue
      }
    }
    promoted.push({ id: l.id, name: l.name, grade: l.grade, newGrade })
  }

  // Audit log
  if (!dryRun && promoted.length > 0) {
    await sb.from('audit_logs').insert({
      actor_id: user.id, actor_email: user.email, actor_role: user.role,
      school_id: schoolId,
      action: 'PROMOTE_LEARNERS',
      entity_type: 'profile',
      description: `Promoted ${promoted.length} learners (from grade ${fromGrade ?? 'all'}, max grade ${maxGrade})`,
      metadata: { promotedCount: promoted.length, graduatedCount: graduated.length, skippedCount: skipped.length },
    })
  }

  return NextResponse.json({
    dryRun, schoolId,
    promotedCount: promoted.length,
    graduatedCount: graduated.length,
    skippedCount: skipped.length,
    promoted, graduated, skipped,
  })
}
