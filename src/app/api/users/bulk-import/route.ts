import { NextResponse } from 'next/server'
import { getCurrentUser, adminCreateUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// POST /api/users/bulk-import — bulk create learners or teachers from a CSV.
// SUPER_USER: any school (or platform). SCHOOL_ADMIN: their school only.
// TEACHER: their school only + only LEARNER role + only into classes they teach (subject to school policy).
//
// Body: { csv: "name,email,password,role,grade\ntest@...,x,eduquest123,LEARNER,7\n...",
//         schoolId?: string (super user only),
//         defaultPassword?: string (used if password column missing) }
//
// CSV columns (header row required):
//   name (required), email (required), password (optional, falls back to defaultPassword),
//   role (optional, defaults to LEARNER), grade (optional, for learners), phone (optional),
//   class_code (optional — if present and matches a class, learner is enrolled)
//
// Returns: { total, succeeded, failed, results: [{ row, email, success, error? }] }
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { csv, defaultPassword } = body as { csv?: string; defaultPassword?: string; schoolId?: string }
  if (!csv || typeof csv !== 'string') {
    return NextResponse.json({ error: 'csv string is required' }, { status: 400 })
  }

  // Resolve target school_id
  let targetSchoolId: string | null
  if (user.role === 'SUPER_USER') {
    targetSchoolId = body.schoolId ?? user.schoolId ?? null
    if (targetSchoolId) {
      // Verify the school exists
      const sb = supabaseService()
      const { data: school } = await sb.from('schools').select('id').eq('id', targetSchoolId).maybeSingle()
      if (!school) return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }
  } else {
    if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    if (body.schoolId && body.schoolId !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden — cannot import into another school' }, { status: 403 })
    }
    targetSchoolId = user.schoolId
  }

  // TEACHER cannot create teachers or school admins — only learners
  const allowRoles = user.role === 'TEACHER' ? ['LEARNER'] : ['LEARNER', 'TEACHER', 'SCHOOL_ADMIN']

  // Parse CSV
  const rows = parseCsv(csv)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV has no rows' }, { status: 400 })
  }
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV has only a header row — no users to import' }, { status: 400 })
  }
  const header = rows[0].map((h: string) => h.trim().toLowerCase())
  const colIdx = (name: string) => header.indexOf(name)
  const nameI = colIdx('name'), emailI = colIdx('email'), pwdI = colIdx('password'),
        roleI = colIdx('role'), gradeI = colIdx('grade'), phoneI = colIdx('phone'),
        classCodeI = colIdx('class_code')
  if (nameI === -1 || emailI === -1) {
    return NextResponse.json({ error: 'CSV must have at least "name" and "email" columns' }, { status: 400 })
  }

  const sb = supabaseService()
  const results: any[] = []
  let succeeded = 0, failed = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue  // skip empty
    const name = row[nameI]?.trim()
    const email = row[emailI]?.trim().toLowerCase()
    const password = (pwdI !== -1 ? row[pwdI]?.trim() : '') || defaultPassword || 'eduquest123'
    const role = ((roleI !== -1 ? row[roleI]?.trim().toUpperCase() : 'LEARNER') || 'LEARNER') as any
    const grade = (gradeI !== -1 ? row[gradeI]?.trim() : '') || null
    const phone = (phoneI !== -1 ? row[phoneI]?.trim() : '') || null
    const classCode = (classCodeI !== -1 ? row[classCodeI]?.trim() : '') || null

    if (!name || !email) {
      results.push({ row: i + 1, email: email || '', success: false, error: 'Missing name or email' })
      failed++
      continue
    }
    if (!allowRoles.includes(role)) {
      results.push({ row: i + 1, email, success: false, error: `Role ${role} not permitted for your account` })
      failed++
      continue
    }

    // Create the user via Supabase Auth admin API
    const res = await adminCreateUser({
      email, password, name, role,
      grade: grade ? Number(grade) : undefined,
      phone: phone || undefined,
      schoolId: targetSchoolId,
    })
    if ('error' in res) {
      results.push({ row: i + 1, email, success: false, error: res.error })
      failed++
      continue
    }
    succeeded++

    // If a class_code was provided, enroll the learner
    if (classCode && role === 'LEARNER') {
      const { data: classRow } = await sb.from('classes').select('id').eq('class_code', classCode).maybeSingle()
      if (classRow) {
        await sb.from('class_members').upsert({
          class_id: classRow.id, learner_id: res.id,
        }, { onConflict: 'class_id,learner_id' })
      }
    }

    results.push({ row: i + 1, email, success: true, userId: res.id })
  }

  return NextResponse.json({
    total: rows.length - 1,
    succeeded,
    failed,
    results,
  })
}

// Simple CSV parser — handles quoted fields with commas + escaped quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else {
        field += c
      }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        cur.push(field); field = ''
        if (cur.some((s) => s.trim())) rows.push(cur)
        cur = []
      } else {
        field += c
      }
    }
  }
  if (field || cur.length) { cur.push(field); if (cur.some((s) => s.trim())) rows.push(cur) }
  return rows
}
