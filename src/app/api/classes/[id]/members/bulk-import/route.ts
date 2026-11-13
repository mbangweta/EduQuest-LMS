import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { adminCreateUser, adminCreateUserFromName, DEFAULT_USER_PASSWORD, PERSONAL_MAX_LEARNERS } from '@/lib/auth-supabase'
import * as XLSX from 'xlsx'

// POST /api/classes/[id]/members/bulk-import
// Accepts multipart/form-data with a `file` field (.xlsx/.xls/.csv).
// Parses the file, creates learner accounts for each row (if needed),
// and enrolls them in the class.
//
// Authorization: SUPER_USER, SCHOOL_ADMIN, or TEACHER who owns / is assigned to the class.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const { id } = await ctx.params
    const sb = supabaseService()

    // Fetch the class + verify authorization
    const { data: cls, error: clsErr } = await sb.from('classes')
      .select('id, name, grade, school_id, teacher_id, subject_id')
      .eq('id', id).maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    // Authorization
    if (user.role === 'TEACHER') {
      if (cls.teacher_id !== user.id) {
        const { data: tca } = await sb.from('teacher_class_assignments')
          .select('id').eq('teacher_id', user.id).eq('class_id', id).maybeSingle()
        if (!tca) return NextResponse.json({ error: 'Forbidden — you are not assigned to this class' }, { status: 403 })
      }
    } else if (user.role === 'SCHOOL_ADMIN') {
      if (cls.school_id !== user.schoolId) {
        return NextResponse.json({ error: 'Forbidden — class not in your school' }, { status: 403 })
      }
    }

    // School context for new learner accounts
    const schoolId = cls.school_id

    // Personal-account limit: max 10 learners total across all their classes.
    // We check this BEFORE parsing the file so we can fail fast with a clear
    // message; the actual import still respects the limit per-row below.
    if (user.institutionType === 'PERSONAL') {
      const { data: myClasses } = await sb.from('classes')
        .select('id').eq('teacher_id', user.id)
      const myClassIds = (myClasses || []).map((c: any) => c.id)
      let totalMembers = 0
      if (myClassIds.length > 0) {
        const { count } = await sb.from('class_members')
          .select('id', { count: 'exact', head: true })
          .in('class_id', myClassIds)
        totalMembers = count ?? 0
      }
      if (totalMembers >= PERSONAL_MAX_LEARNERS) {
        return NextResponse.json(
          { error: `Individual teacher accounts are limited to ${PERSONAL_MAX_LEARNERS} learners in total. You already have ${totalMembers}. Upgrade to a School account to enrol more.` },
          { status: 403 },
        )
      }
    }

    // Parse the uploaded file
    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    let rows: any[][] = []
    try {
      const wb = XLSX.read(buf, { type: 'buffer' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to parse file: ${e?.message}` }, { status: 400 })
    }
    if (rows.length === 0) return NextResponse.json({ error: 'File has no rows' }, { status: 400 })
    if (rows.length < 2) return NextResponse.json({ error: 'File has only a header row — no learner data' }, { status: 400 })

    // Normalize headers
    const header = rows[0].map((h: any) => String(h || '').trim().toLowerCase())
    const colIdx = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n)
        if (i !== -1) return i
      }
      return -1
    }
    const fnI = colIdx('first_name', 'firstname', 'first name', 'fname')
    const lnI = colIdx('last_name', 'lastname', 'last name', 'lname', 'surname')
    const nameI = colIdx('name', 'full_name', 'fullname', 'learner_name')
    const emailI = colIdx('email', 'e-mail')
    const gradeI = colIdx('grade', 'class_grade')
    const phoneI = colIdx('phone', 'mobile', 'tel')
    const pwdI = colIdx('password', 'pwd')

    if (fnI === -1 && lnI === -1 && nameI === -1) {
      return NextResponse.json({
        error: 'Could not find a name column. Expected: first_name + last_name, or name. Found headers: ' + header.join(', '),
      }, { status: 400 })
    }

    const results: Array<{
      row: number
      name: string
      email: string
      status: 'created' | 'enrolled' | 'exists' | 'error'
      error?: string
    }> = []

    let created = 0, enrolled = 0, existing = 0, errors = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every((c: any) => c === null || c === undefined || String(c).trim() === '')) continue

      // Build the learner's name
      let firstName = fnI !== -1 ? String(row[fnI] ?? '').trim() : ''
      let lastName = lnI !== -1 ? String(row[lnI] ?? '').trim() : ''
      let fullName: string

      if (firstName || lastName) {
        fullName = `${firstName} ${lastName}`.trim()
      } else if (nameI !== -1) {
        fullName = String(row[nameI] ?? '').trim()
        // Try to split into first/last
        const parts = fullName.split(/\s+/)
        firstName = parts[0] || ''
        lastName = parts.slice(1).join(' ') || ''
      } else {
        results.push({ row: i + 1, name: '(no name)', email: '', status: 'error', error: 'No name provided' })
        errors++
        continue
      }

      if (!fullName) {
        results.push({ row: i + 1, name: '(empty)', email: '', status: 'error', error: 'Name is empty' })
        errors++
        continue
      }

      const email = emailI !== -1 ? String(row[emailI] ?? '').trim().toLowerCase() : ''
      const phone = phoneI !== -1 ? String(row[phoneI] ?? '').trim() || undefined : undefined
      const password = pwdI !== -1 ? String(row[pwdI] ?? '').trim() || DEFAULT_USER_PASSWORD : DEFAULT_USER_PASSWORD
      const grade = gradeI !== -1 ? Number(row[gradeI]) || cls.grade : cls.grade

      try {
        // Check if the learner already exists by email
        let learnerId: string | undefined
        if (email) {
          const { data: existingUser } = await sb.from('profiles')
            .select('id, role, school_id').eq('email', email).maybeSingle()
          if (existingUser) {
            if (existingUser.role !== 'LEARNER') {
              results.push({ row: i + 1, name: fullName, email, status: 'error', error: 'Email belongs to a non-learner account' })
              errors++
              continue
            }
            learnerId = existingUser.id
            existing++
          }
        }

        // If no existing user found, create one
        if (!learnerId) {
          // Determine the school: SCHOOL_ADMIN uses their own; SUPER_USER uses the class's school
          const targetSchoolId = user.role === 'SUPER_USER' ? schoolId : (user.schoolId || schoolId)

          if (email) {
            // Create with the provided email
            const res = await adminCreateUser({
              email, password, name: fullName, role: 'LEARNER',
              grade, phone, schoolId: targetSchoolId,
            })
            if ('error' in res) {
              results.push({ row: i + 1, name: fullName, email, status: 'error', error: res.error })
              errors++
              continue
            }
            learnerId = res.id
          } else {
            // Auto-generate the email
            const res = await adminCreateUserFromName({
              firstName: firstName || fullName,
              lastName: lastName || '',
              role: 'LEARNER',
              grade, phone, schoolId: targetSchoolId,
            })
            if ('error' in res) {
              results.push({ row: i + 1, name: fullName, email: '(auto)', status: 'error', error: res.error })
              errors++
              continue
            }
            learnerId = res.id
          }
          created++
        }

        // Enroll the learner in the class (upsert — skip if already enrolled)
        const { error: enrollErr } = await sb.from('class_members')
          .upsert({ class_id: id, learner_id: learnerId }, { onConflict: 'class_id,learner_id' })
        if (enrollErr) {
          results.push({ row: i + 1, name: fullName, email: email || '(auto)', status: 'error', error: enrollErr.message })
          errors++
          continue
        }
        enrolled++

        results.push({
          row: i + 1,
          name: fullName,
          email: email || '(auto-generated)',
          status: existing > 0 && created === 0 ? 'enrolled' : 'created',
        })
      } catch (e: any) {
        results.push({ row: i + 1, name: fullName, email: email || '(auto)', status: 'error', error: e?.message || 'Unknown error' })
        errors++
      }
    }

    return NextResponse.json({
      ok: true,
      total: results.length,
      created,
      existing,
      enrolled,
      errors,
      results,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
