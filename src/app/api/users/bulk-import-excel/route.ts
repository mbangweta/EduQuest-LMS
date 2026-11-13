import { NextResponse } from 'next/server'
import { getCurrentUser, adminCreateUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// POST /api/users/bulk-import-excel — accepts multipart/form-data with `file` (.xlsx/.xls/.csv).
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  const file = formData.get('file')
  const schoolIdForm = formData.get('schoolId')
  const defaultPassword = (formData.get('defaultPassword') as string) || 'eduquest123'
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 })
  }

  let targetSchoolId: string | null
  if (user.role === 'SUPER_USER') {
    targetSchoolId = (schoolIdForm as string) || user.schoolId || null
    if (targetSchoolId) {
      const sb = supabaseService()
      const { data: school } = await sb.from('schools').select('id').eq('id', targetSchoolId).maybeSingle()
      if (!school) return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }
  } else {
    if (!user.schoolId) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
    if (schoolIdForm && (schoolIdForm as string) !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden — cannot import into another school' }, { status: 403 })
    }
    targetSchoolId = user.schoolId
  }

  const allowRoles = user.role === 'TEACHER' ? ['LEARNER'] : ['LEARNER', 'TEACHER', 'SCHOOL_ADMIN']

  const buf = Buffer.from(await file.arrayBuffer())
  let rows: any[][] = []
  try {
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to parse file: ${e?.message || 'unknown error'}` }, { status: 400 })
  }
  if (rows.length === 0) return NextResponse.json({ error: 'File has no rows' }, { status: 400 })
  if (rows.length < 2) return NextResponse.json({ error: 'File has only a header row' }, { status: 400 })

  const header = rows[0].map((h: any) => String(h || '').trim().toLowerCase())
  const colIdx = (name: string) => header.indexOf(name)
  const nameI = colIdx('name'), emailI = colIdx('email'), pwdI = colIdx('password'),
        roleI = colIdx('role'), gradeI = colIdx('grade'), phoneI = colIdx('phone'),
        classCodeI = colIdx('class_code')
  if (nameI === -1 || emailI === -1) {
    return NextResponse.json({ error: 'Excel must have at least "name" and "email" columns' }, { status: 400 })
  }

  const sb = supabaseService()
  const results: any[] = []
  let succeeded = 0, failed = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (row.length === 0 || (row.length === 1 && !row[0])) continue
    const name = String(row[nameI] ?? '').trim()
    const email = String(row[emailI] ?? '').trim().toLowerCase()
    const password = (pwdI !== -1 ? String(row[pwdI] ?? '').trim() : '') || defaultPassword
    const role = (roleI !== -1 ? String(row[roleI] ?? '').trim().toUpperCase() : 'LEARNER') || 'LEARNER'
    const grade = (gradeI !== -1 ? String(row[gradeI] ?? '').trim() : '') || null
    const phone = (phoneI !== -1 ? String(row[phoneI] ?? '').trim() : '') || null
    const classCode = (classCodeI !== -1 ? String(row[classCodeI] ?? '').trim() : '') || null

    if (!name || !email) {
      results.push({ row: i + 1, email: email || '', success: false, error: 'Missing name or email' })
      failed++
      continue
    }
    if (!allowRoles.includes(role)) {
      results.push({ row: i + 1, email, success: false, error: `Role ${role} not permitted` })
      failed++
      continue
    }
    const res = await adminCreateUser({
      email, password, name, role: role as any,
      grade: grade ? Number(grade) : undefined, phone: phone || undefined,
      schoolId: targetSchoolId,
    })
    if ('error' in res) {
      results.push({ row: i + 1, email, success: false, error: res.error })
      failed++
      continue
    }
    succeeded++
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

  // Audit log
  await sb.from('audit_logs').insert({
    actor_id: user.id, actor_email: user.email, actor_role: user.role,
    school_id: targetSchoolId,
    action: 'BULK_IMPORT_USERS',
    entity_type: 'profile',
    description: `Bulk imported ${succeeded} users (${failed} failed) via Excel/CSV upload`,
    metadata: { total: rows.length - 1, succeeded, failed, fileName: file.name },
  })

  return NextResponse.json({ total: rows.length - 1, succeeded, failed, results })
}
