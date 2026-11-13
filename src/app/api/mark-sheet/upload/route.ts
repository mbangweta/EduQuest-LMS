import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { STANDARD_SUBJECTS, resolveSubjectCode } from '@/lib/assessment-utils'

// ============================================================================
// POST /api/mark-sheet/upload
// ----------------------------------------------------------------------------
// Parses an uploaded Excel mark sheet for a class + term and writes the scores
// into the assessments / assessment_scores tables.
//
// Expected Excel layout (produced by MarkSheetButtons.downloadTemplate):
//   Row 1 (header): S/N | NAME | MATHEMATICS | ENGLISH | SCIENCE | ... | TOTAL | POSITION
//   Row 2..N:        1   | John | 120         | 95      | 110     | ... | (formula) |
//   Last row:        ''  | Average | =AVERAGE(...) per subject
//
// For each subject column found in the header:
//   1. Resolve the column header to a STANDARD_SUBJECTS code (via resolveSubjectCode).
//   2. Look up the subject_id in the `subjects` table by code. If missing, auto-create
//      the subject row so uploads never hard-fail just because the seed SQL wasn't run.
//   3. Find an existing END_OF_TERM assessment for this class + term + subject.
//      If none exists, create one (max_score=150, weight=1.0, status=PUBLISHED).
//   4. For each learner row, match by name (case-insensitive, trimmed) to the
//      class roster, then upsert the score into assessment_scores.
//
// The Average row, the TOTAL column, and the POSITION column are ignored
// (TOTAL/POSITION are formulas; we read only the per-subject, per-learner cells).
//
// Returns a JSON summary used by the UI to show import feedback.
// ============================================================================
export async function POST(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()

    const form = await req.formData()
    const file = form.get('file')
    const classId = String(form.get('classId') || '')
    const termRaw = String(form.get('term') || '1')
    const term = Number(termRaw) || 1

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    // ---- 1. Verify the class + authorization + load roster ------------------
    const { data: cls } = await sb.from('classes')
      .select('id, school_id, teacher_id, grade, name')
      .eq('id', classId).maybeSingle()
    if (!cls) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      // Also allow teachers explicitly assigned to this class
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

    // Roster: class_members → profiles
    const { data: members } = await sb.from('class_members').select(`
      learner_id,
      learner:profiles(id, name)
    `).eq('class_id', classId)
    const roster: Array<{ id: string; name: string }> = (members || [])
      .map((m: any) => m.learner)
      .filter(Boolean)
      .map((p: any) => ({ id: p.id, name: p.name || '' }))

    if (roster.length === 0) {
      return NextResponse.json({ error: 'This class has no enrolled learners' }, { status: 400 })
    }

    // Build a name → learnerId lookup (case-insensitive, trimmed)
    const nameLookup = new Map<string, { id: string; name: string }>()
    for (const r of roster) {
      nameLookup.set(r.name.trim().toLowerCase(), r)
    }

    // ---- 2. Read the Excel file --------------------------------------------
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'Excel file has no sheets' }, { status: 400 })
    }
    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: true,
    }) as any[][]

    if (rows.length < 2) {
      return NextResponse.json({ error: 'Excel file has no data rows' }, { status: 400 })
    }

    // ---- 3. Parse header row to find subject columns -----------------------
    const headerRow = rows[0].map((c: any) => (c == null ? '' : String(c).trim()))
    // Find NAME column (must exist)
    const nameColIdx = headerRow.findIndex((h: string) => h.toUpperCase() === 'NAME')
    if (nameColIdx < 0) {
      return NextResponse.json(
        { error: 'Could not find a "NAME" column in the header row' },
        { status: 400 },
      )
    }

    // Map: column index → subject code (only columns whose header resolves)
    const subjectCols: Array<{ colIdx: number; code: string }> = []
    const subjectsSkipped: string[] = []
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i]
      if (!h) continue
      const upper = h.toUpperCase()
      // Skip non-subject columns
      if (upper === 'S/N' || upper === 'SN' || upper === 'NO' || upper === '#'
          || upper === 'NAME' || upper === 'STUDENT' || upper === 'LEARNER'
          || upper === 'TOTAL' || upper === 'AVERAGE' || upper === 'AVG'
          || upper === '%' || upper === 'PERCENT' || upper === 'POSITION'
          || upper === 'RANK' || upper === 'GRADE' || upper === 'REMARKS') {
        continue
      }
      const code = resolveSubjectCode(h)
      if (code) {
        // Avoid duplicate columns for the same subject (first one wins)
        if (!subjectCols.some((s) => s.code === code)) {
          subjectCols.push({ colIdx: i, code })
        }
      } else {
        // Unknown header — record it as skipped (not a recognized subject)
        subjectsSkipped.push(h)
      }
    }

    if (subjectCols.length === 0) {
      return NextResponse.json(
        { error: 'No subject columns were recognized in the header row', subjectsSkipped },
        { status: 400 },
      )
    }

    // ---- 4. Resolve subject codes → subject_ids from the DB ----------------
    const codesNeeded = Array.from(new Set(subjectCols.map((s) => s.code)))
    const { data: dbSubjects } = await sb.from('subjects')
      .select('id, code, name').in('code', codesNeeded)
    const subjectIdByCode = new Map<string, { id: string; name: string }>()
    for (const s of (dbSubjects || [])) {
      subjectIdByCode.set(String(s.code).toUpperCase(), { id: s.id, name: s.name })
    }
    // For any code not in the DB, auto-create the subject row so the upload
    // never hard-fails just because the subjects table hasn't been seeded.
    const missingCodes = codesNeeded.filter((c) => !subjectIdByCode.has(c.toUpperCase()))
    if (missingCodes.length > 0) {
      const stdRows = missingCodes
        .map((code) => STANDARD_SUBJECTS.find((s) => s.code === code))
        .filter(Boolean) as Array<{ code: string; name: string; color: string }>
      if (stdRows.length > 0) {
        const toInsert = stdRows.map((s) => ({
          code: s.code, name: s.name, description: s.name, color: s.color,
        }))
        const { data: inserted, error: insErr } = await sb.from('subjects')
          .insert(toInsert).select('id, code, name')
        if (!insErr && inserted) {
          for (const s of inserted) subjectIdByCode.set(String(s.code).toUpperCase(), { id: s.id, name: s.name })
        }
      }
    }

    // Final list of subject columns we will actually process (DB-resolved only)
    const processedCols = subjectCols.filter((sc) => subjectIdByCode.has(sc.code.toUpperCase()))
    const subjectsProcessedNames = processedCols.map((sc) => {
      const std = STANDARD_SUBJECTS.find((s) => s.code === sc.code)
      return std?.name || subjectIdByCode.get(sc.code.toUpperCase())?.name || sc.code
    })
    // Append unresolved codes to subjectsSkipped
    for (const sc of subjectCols) {
      if (!subjectIdByCode.has(sc.code.toUpperCase())) {
        subjectsSkipped.push(sc.code)
      }
    }

    // ---- 5. Find or create one END_OF_TERM assessment per subject ----------
    const assessmentByCode = new Map<string, { id: string; maxScore: number }>()
    for (const sc of processedCols) {
      const subjInfo = subjectIdByCode.get(sc.code.toUpperCase())!
      // Look for an existing END_OF_TERM assessment for this class + term + subject
      const { data: existing } = await sb.from('assessments')
        .select('id, max_score')
        .eq('class_id', classId)
        .eq('term', term)
        .eq('subject_id', subjInfo.id)
        .eq('type', 'END_OF_TERM')
        .maybeSingle()
      if (existing) {
        assessmentByCode.set(sc.code, { id: existing.id, maxScore: Number(existing.max_score) || 150 })
        continue
      }
      // Create it
      const std = STANDARD_SUBJECTS.find((s) => s.code === sc.code)
      const title = `${std?.name || subjInfo.name} — End of Term ${term}`
      const { data: created, error: createErr } = await sb.from('assessments').insert({
        school_id: schoolId,
        academic_year_id: null,
        title,
        description: `Imported via Mark Sheet upload`,
        type: 'END_OF_TERM',
        term,
        subject_id: subjInfo.id,
        grade: cls.grade,
        class_id: classId,
        teacher_id: user.id,
        date: new Date().toISOString().slice(0, 10),
        max_score: 150,
        weight: 1.0,
        status: 'PUBLISHED',
      }).select().single()
      if (createErr || !created) {
        // Skip this subject but don't fail the whole upload
        subjectsSkipped.push(`${sc.code} (create failed: ${createErr?.message || 'unknown'})`)
        continue
      }
      assessmentByCode.set(sc.code, { id: created.id, maxScore: 150 })
    }

    // ---- 6. Walk data rows and collect scores ------------------------------
    // Skip rows whose NAME cell is empty or equals "Average" (case-insensitive)
    const matchedLearnerIds = new Set<string>()
    const unmatchedLearnerNames: string[] = []
    // per assessment: Map<learnerId, number>
    const scoresByAssessment = new Map<string, Map<string, number>>()
    // Used to know which learner_ids are valid for bulk upsert
    const validLearnerIds = new Set(roster.map((r) => r.id))

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || []
      const nameCell = row[nameColIdx]
      const nameStr = (nameCell == null ? '' : String(nameCell)).trim()
      if (!nameStr) continue
      if (nameStr.toLowerCase() === 'average' || nameStr.toLowerCase() === 'avg') continue

      const key = nameStr.toLowerCase()
      const learner = nameLookup.get(key)
      if (!learner) {
        unmatchedLearnerNames.push(nameStr)
        continue
      }
      matchedLearnerIds.add(learner.id)

      for (const sc of processedCols) {
        const cell = row[sc.colIdx]
        if (cell === null || cell === undefined || cell === '') continue
        const num = Number(cell)
        if (Number.isNaN(num)) continue
        const aInfo = assessmentByCode.get(sc.code)
        if (!aInfo) continue
        const inner = scoresByAssessment.get(aInfo.id) ?? new Map<string, number>()
        // Clamp to [0, maxScore]
        const clamped = Math.max(0, Math.min(aInfo.maxScore, num))
        inner.set(learner.id, clamped)
        scoresByAssessment.set(aInfo.id, inner)
      }
    }

    // ---- 7. Bulk upsert scores per assessment ------------------------------
    let scoresInserted = 0
    let scoresUpdated = 0
    const now = new Date().toISOString()

    for (const [assessmentId, learnerScoreMap] of scoresByAssessment.entries()) {
      // Fetch existing
      const { data: existingScores } = await sb.from('assessment_scores')
        .select('id, learner_id').eq('assessment_id', assessmentId)
      const existingMap = new Map<string, string>()
      for (const row of (existingScores || [])) existingMap.set(row.learner_id, row.id)

      const toInsert: any[] = []
      const toUpdate: any[] = []
      for (const [learnerId, score] of learnerScoreMap.entries()) {
        if (!validLearnerIds.has(learnerId)) continue
        const existingId = existingMap.get(learnerId)
        if (existingId) {
          toUpdate.push({
            id: existingId,
            score,
            recorded_by: user.id,
            recorded_at: now,
          })
        } else {
          toInsert.push({
            assessment_id: assessmentId,
            learner_id: learnerId,
            score,
            remarks: null,
            recorded_by: user.id,
            recorded_at: now,
          })
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await sb.from('assessment_scores').insert(toInsert)
        if (!insErr) scoresInserted += toInsert.length
      }
      for (const u of toUpdate) {
        const { error: updErr } = await sb.from('assessment_scores')
          .update({ score: u.score, recorded_by: u.recorded_by, recorded_at: u.recorded_at })
          .eq('id', u.id)
        if (!updErr) scoresUpdated += 1
      }
    }

    // ---- 8. Return summary --------------------------------------------------
    return NextResponse.json({
      ok: true,
      classId,
      term,
      subjectsProcessed: subjectsProcessedNames,
      subjectsProcessedCount: subjectsProcessedNames.length,
      subjectsSkipped: Array.from(new Set(subjectsSkipped)),
      learnersMatched: matchedLearnerIds.size,
      learnersUnmatched: unmatchedLearnerNames.length,
      unmatchedLearners: unmatchedLearnerNames,
      scoresInserted,
      scoresUpdated,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    console.error('[api/mark-sheet/upload]', e)
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
