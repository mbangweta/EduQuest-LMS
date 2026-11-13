import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { STANDARD_SUBJECTS } from '@/lib/assessment-utils'

// ============================================================================
// POST /api/mark-schedule/initialize
// ----------------------------------------------------------------------------
// Creates an END_OF_TERM assessment (max_score=150, weight=1.0, status=DRAFT)
// for each of the 10 standard Zambian subjects for the given class + term,
// ONLY if one doesn't already exist. This lets teachers start entering scores
// online without having to download/upload the Excel template first.
//
// Body: { classId, term }
// Returns: { created: string[], existing: string[], subjects: [{code, assessmentId}] }
// ============================================================================
export async function POST(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    if (user.institutionType === 'PERSONAL') {
      return NextResponse.json(
        { error: 'Mark Schedule is not available for individual teacher accounts.' },
        { status: 403 },
      )
    }
    const sb = supabaseService()
    const body = await req.json().catch(() => ({}))
    const classId = String(body.classId || '')
    const term = Number(body.term) || 1
    // testType defaults to END_OF_TERM; can be TEST_1..TEST_6
    const testType = String(body.testType || 'END_OF_TERM')

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    // 1. Verify class + authorization
    const { data: cls } = await sb.from('classes')
      .select('id, school_id, teacher_id, grade, name')
      .eq('id', classId).maybeSingle()
    if (!cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
      if (!tca) {
        return NextResponse.json({ error: 'Forbidden — you do not teach this class' }, { status: 403 })
      }
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden — class not in your school' }, { status: 403 })
    }
    const schoolId = cls.school_id || user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with this class.' }, { status: 400 })
    }

    // 2. Resolve subject IDs (auto-create missing)
    const allCodes = STANDARD_SUBJECTS.map((s) => s.code)
    const { data: dbSubjects } = await sb.from('subjects')
      .select('id, code, name').in('code', allCodes)
    const subjectIdByCode = new Map<string, { id: string; name: string }>()
    for (const s of (dbSubjects || [])) {
      subjectIdByCode.set(String(s.code).toUpperCase(), { id: s.id, name: s.name })
    }
    const missingCodes = allCodes.filter((c) => !subjectIdByCode.has(c.toUpperCase()))
    if (missingCodes.length > 0) {
      const stdRows = missingCodes
        .map((code) => STANDARD_SUBJECTS.find((s) => s.code === code))
        .filter(Boolean) as Array<{ code: string; name: string; color: string }>
      const { data: inserted } = await sb.from('subjects')
        .insert(stdRows.map((s) => ({
          code: s.code, name: s.name, description: s.name, color: s.color,
        })))
        .select('id, code, name')
      if (inserted) {
        for (const s of inserted) {
          subjectIdByCode.set(String(s.code).toUpperCase(), { id: s.id, name: s.name })
        }
      }
    }

    // 3. For each standard subject, find or create an END_OF_TERM assessment
    const created: string[] = []
    const existing: string[] = []
    const subjects: Array<{ code: string; assessmentId: string }> = []
    const today = new Date().toISOString().slice(0, 10)

    for (const std of STANDARD_SUBJECTS) {
      const subjInfo = subjectIdByCode.get(std.code.toUpperCase())
      if (!subjInfo) continue

      const { data: existingAssessment } = await sb.from('assessments')
        .select('id')
        .eq('class_id', classId)
        .eq('term', term)
        .eq('subject_id', subjInfo.id)
        .eq('type', testType)
        .maybeSingle()

      if (existingAssessment) {
        existing.push(existingAssessment.id)
        subjects.push({ code: std.code, assessmentId: existingAssessment.id })
        continue
      }

      const { data: createdAssessment, error: createErr } = await sb.from('assessments').insert({
        school_id: schoolId,
        academic_year_id: null,
        title: `${subjInfo.name} — ${testType === 'END_OF_TERM' ? 'End of Term' : testType.replace('_', ' ')} ${term}`,
        description: `Auto-created for online mark entry`,
        type: testType,
        term,
        subject_id: subjInfo.id,
        grade: cls.grade,
        class_id: classId,
        teacher_id: user.id,
        date: today,
        max_score: 150,
        weight: 1.0,
        status: 'PUBLISHED',  // so the report-card API picks it up immediately
      }).select().single()

      if (createErr || !createdAssessment) {
        console.error('[mark-schedule/initialize] failed for', std.code, createErr)
        continue
      }
      created.push(createdAssessment.id)
      subjects.push({ code: std.code, assessmentId: createdAssessment.id })
    }

    return NextResponse.json({
      ok: true,
      classId,
      term,
      createdCount: created.length,
      existingCount: existing.length,
      created,
      existing,
      subjects,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    console.error('[api/mark-schedule/initialize]', e)
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
