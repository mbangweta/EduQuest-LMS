import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import {
  MAX_REPORT_SCORE, gradeForScore, normalizeTo150, GRADING_SCALE,
  STANDARD_SUBJECTS, computeTermTotal, remarkForGrade,
} from '@/lib/assessment-utils'

// GET /api/report-cards/[learnerId]?term=...
// Generates a full report card matching the Zambian school report card format:
//   - School details (name, motto, address, phone, email, website)
//   - Class teacher name
//   - Per-subject scores broken down by assessment type:
//       TEST 1 (FORTNIGHTLY), TEST 2 (MONTHLY), TEST 3 (MIDTERM), END TERM (END_OF_TERM)
//   - Term average + letter grade per subject (Chudleigh grading scale)
//   - Auto-generated remark per subject
//   - Total score, pupil's mark, class average
//   - Auto-generated class teacher comment
//   - Grading scale legend
//
// Authorization:
//   LEARNER: only their own / TEACHER: learners in their classes
//   SCHOOL_ADMIN: any learner in their school / SUPER_USER: any learner

// Map internal assessment types → report card column labels
const TYPE_COLUMNS: Array<{ type: string; label: string }> = [
  { type: 'FORTNIGHTLY', label: 'TEST 1' },
  { type: 'MONTHLY', label: 'TEST 2' },
  { type: 'MIDTERM', label: 'TEST 3' },
  { type: 'END_OF_TERM', label: 'END TERM' },
]

// Remark generator using the 6-grade scale (A-F) — remarks come from the
// shared GRADING_SCALE constant so they always match the spec.
function remarkForSubject(grade: string, score: number | null, subjectName: string): string {
  if (score === null) return 'No scores recorded yet.'
  const base = remarkForGrade(grade)
  // Optional subject-specific framing on top of the canonical remark
  switch (grade) {
    case 'A':
      if (score >= 148) return `An outstanding, near-perfect performance in ${subjectName}! (${base})`
      return `An excellent and perfectly stable performance in ${subjectName}! (${base})`
    case 'B':
      return `A very good performance in ${subjectName}. (${base})`
    case 'C':
      return `A good performance in ${subjectName} with room to grow. (${base})`
    case 'D':
      return `A fair result in ${subjectName} — more effort will lift this significantly. (${base})`
    case 'E':
      return `An average result in ${subjectName} — significant improvement is needed. (${base})`
    case 'F':
      return `A very weak area in ${subjectName} that needs urgent attention and extra practice. (${base})`
    default:
      return '—'
  }
}

// Auto-generated teacher comment based on overall score (out of 150).
function autoTeacherComment(learnerName: string, overallScore: number | null, bestSubject: string | null, worstSubject: string | null): string {
  if (overallScore === null) return `No scores have been recorded for ${learnerName} yet this term.`
  const firstName = learnerName.split(' ')[0]
  if (overallScore >= 140) {
    return `${firstName} is a top-tier student who maintains absolute brilliance across most subjects. ${
      worstSubject ? `Continued attention to ${worstSubject} will ensure an even stronger overall profile.` : 'Keep up the excellent work.'
    }`
  }
  if (overallScore >= 120) {
    return `${firstName} is performing well overall${
      bestSubject ? `, with particular strength in ${bestSubject}` : ''
    }. ${
      worstSubject ? `More focus on ${worstSubject} will help raise the overall standing.` : 'Keep pushing for higher marks.'
    }`
  }
  if (overallScore >= 75) {
    return `${firstName} is making fair progress${
      bestSubject ? ` and shows potential in ${bestSubject}` : ''
    }. ${
      worstSubject ? `Extra effort in ${worstSubject} is needed to improve the overall standing.` : 'More consistent effort across all subjects is encouraged.'
    }`
  }
  return `${firstName} needs significant support this term${
    worstSubject ? `, particularly in ${worstSubject}` : ''
  }. A structured study plan and closer monitoring are recommended.`
}

export async function GET(req: Request, { params }: { params: Promise<{ learnerId: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    // Personal (individual teacher) accounts don't get Report Card access.
    // (LEARNER is allowed — they view their own report card.)
    if (user.institutionType === 'PERSONAL' && user.role !== 'LEARNER') {
      return NextResponse.json(
        { error: 'Report Cards are not available for individual teacher accounts. Upgrade to a School account to access this feature.' },
        { status: 403 },
      )
    }
    const { learnerId } = await params
    const sb = supabaseService()
    const url = new URL(req.url)
    const term = url.searchParams.get('term')

    // 1. Learner profile
    const { data: learner, error: lErr } = await sb.from('profiles')
      .select('id, name, email, grade, school_id, school:schools(id, name, code, motto, address, phone, email, website, logo_url)')
      .eq('id', learnerId).eq('role', 'LEARNER').single()
    if (lErr || !learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 })

    // Authorization
    if (user.role === 'LEARNER' && user.id !== learnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && learner.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'TEACHER') {
      const { data: myClasses } = await sb.from('classes').select('id').eq('teacher_id', user.id)
      const myClassIds = (myClasses || []).map((c: any) => c.id)
      if (myClassIds.length > 0) {
        const { count } = await sb.from('class_members')
          .select('id', { count: 'exact', head: true })
          .eq('learner_id', learnerId).in('class_id', myClassIds)
        if (!count) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // 2. Find the learner's class (for the term — pick the first class they're enrolled in)
    const { data: memberships } = await sb.from('class_members').select(`
      class_id,
      class:classes(id, name, grade, teacher_id, teacher:profiles(id, name))
    `).eq('learner_id', learnerId)
    const firstClass = (memberships || [])[0]?.class
    const teacherName = firstClass?.teacher?.name || '—'
    const className = firstClass?.name || `Grade ${learner.grade}`

    // 3. School details
    const school = learner.school
    const schoolDetails = school ? {
      name: school.name,
      motto: school.motto || '',
      address: school.address || '',
      phone: school.phone || '',
      email: school.email || '',
      website: school.website || '',
      logoUrl: school.logo_url || '',
    } : null

    // 4. All assessments for this learner's school + grade (+ optional term)
    let aq = sb.from('assessments').select(`
      id, title, type, term, max_score, weight, date, status, subject_id, grade, class_id, school_id,
      subject:subjects(id, name, code, color)
    `).eq('grade', learner.grade).eq('school_id', learner.school_id).eq('status', 'PUBLISHED')
    if (term) aq = aq.eq('term', Number(term))
    const { data: assessments } = await aq
    const assessmentIds = (assessments || []).map((a: any) => a.id)

    // 5. This learner's scores
    let myScores: any[] = []
    if (assessmentIds.length > 0) {
      const { data: sRows } = await sb.from('assessment_scores')
        .select('assessment_id, score, remarks')
        .eq('learner_id', learnerId).in('assessment_id', assessmentIds)
      myScores = sRows || []
    }
    const myScoreMap = new Map<string, number | null>()
    for (const s of myScores) {
      myScoreMap.set(s.assessment_id, s.score === null || s.score === undefined ? null : Number(s.score))
    }

    // 6. All scores for these assessments (for class average calculation)
    let allScoreRows: any[] = []
    if (assessmentIds.length > 0) {
      const { data: asr } = await sb.from('assessment_scores')
        .select('assessment_id, learner_id, score')
        .in('assessment_id', assessmentIds)
      allScoreRows = asr || []
    }
    const allScoresByAssessment = new Map<string, Map<string, number | null>>()
    for (const s of allScoreRows) {
      const inner = allScoresByAssessment.get(s.assessment_id) ?? new Map<string, number | null>()
      inner.set(s.learner_id, s.score === null || s.score === undefined ? null : Number(s.score))
      allScoresByAssessment.set(s.assessment_id, inner)
    }

    // 7. Group assessments by subject
    const bySubject = new Map<string, any[]>()
    for (const a of (assessments || [])) {
      const list = bySubject.get(a.subject_id) ?? []
      list.push(a)
      bySubject.set(a.subject_id, list)
    }

    // 8. Build per-subject report
    const subjectReports: any[] = []
    for (const [subjectId, aList] of Array.from(bySubject.entries())) {
      const subject = aList[0].subject
      // Break down by assessment type
      const scoresByType: Record<string, number | null> = {}
      let totalScore = 0
      let totalMax = 0
      let recordedCount = 0

      for (const tc of TYPE_COLUMNS) {
        // Find the assessment of this type for this subject
        const a = aList.find((x: any) => x.type === tc.type)
        if (a) {
          const sc = myScoreMap.get(a.id) ?? null
          scoresByType[tc.label] = sc
          if (sc !== null) {
            totalScore += sc
            totalMax += a.max_score
            recordedCount++
          }
        } else {
          scoresByType[tc.label] = null
        }
      }

      // Normalize each recorded score to the 150-point scale, then average.
      // This way grades are always computed against the Chudleigh scale
      // (A: 135-150, B: 125-134, …) regardless of the assessment's max_score.
      let normalizedSum = 0
      const normalizedScores: Record<string, number | null> = {}
      for (const tc of TYPE_COLUMNS) {
        const v = scoresByType[tc.label]
        if (v !== null && v !== undefined) {
          const a = aList.find((x: any) => x.type === tc.type)
          const norm = normalizeTo150(v, a?.max_score || 100)
          normalizedScores[tc.label] = norm
          normalizedSum += norm
        } else {
          normalizedScores[tc.label] = null
        }
      }
      const termAvg = recordedCount > 0 ? Math.round(normalizedSum / recordedCount) : null
      const grade = gradeForScore(termAvg)
      const remark = remarkForSubject(grade, termAvg, subject?.name || 'this subject')

      subjectReports.push({
        subject: subject ? {
          id: subject.id, name: subject.name, code: subject.code, color: subject.color,
        } : { id: subjectId, name: 'Subject', code: '' },
        scoresByType: normalizedScores,  // already normalized to 150
        termAverage: termAvg,            // out of 150
        maxPerTest: MAX_REPORT_SCORE,
        grade,
        remark,
        recordedCount,
      })
    }

    // 8b. Ensure ALL 10 standard subjects appear, even if they have no assessments.
    //     Fetch subject IDs from the database for the standard subject codes.
    const standardCodes = STANDARD_SUBJECTS.map((s) => s.code)
    const { data: standardSubjectRows } = await sb.from('subjects')
      .select('id, name, code, color').in('code', standardCodes)
    const standardByCode = new Map<string, any>()
    for (const s of (standardSubjectRows || [])) {
      standardByCode.set(String(s.code).toUpperCase(), s)
    }
    // For each standard subject that's NOT already in subjectReports, add an empty entry
    for (const std of STANDARD_SUBJECTS) {
      const subjectRow = standardByCode.get(std.code)
      if (!subjectRow) continue  // subject not in DB — skip
      const alreadyIncluded = subjectReports.some((sr) => sr.subject.code?.toUpperCase() === std.code)
      if (!alreadyIncluded) {
        subjectReports.push({
          subject: { id: subjectRow.id, name: subjectRow.name, code: subjectRow.code, color: subjectRow.color },
          scoresByType: { 'TEST 1': null, 'TEST 2': null, 'TEST 3': null, 'END TERM': null },
          termAverage: null,
          maxPerTest: MAX_REPORT_SCORE,
          grade: '—',
          remark: 'No scores recorded yet.',
          recordedCount: 0,
        })
      }
    }

    // Sort by the standard subject order (MATH, ENG, SCI, SS, ZL, SP1, SP2, TS, HE, EA)
    const codeOrder = STANDARD_SUBJECTS.map((s) => s.code.toUpperCase())
    subjectReports.sort((a, b) => {
      const ai = codeOrder.indexOf((a.subject.code || '').toUpperCase())
      const bi = codeOrder.indexOf((b.subject.code || '').toUpperCase())
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })

    // 9. Compute totals using the grade-based Zambian spec:
    //    Grades 6-7: SP1 + SP2 + best 4 from remaining 8
    //    Grades 5-:  MATH + ENG + SCI + SS + best 2 from remaining 6
    // The same calc is used by /api/mark-schedule so the totals match.
    const normalizedForTermTotal: Array<{ code: string; score: number | null }> = subjectReports.map((sr) => ({
      code: (sr.subject.code || '').toUpperCase(),
      score: sr.termAverage,  // already normalized to /150
    }))
    const termTotalResult = computeTermTotal(learner.grade || 5, normalizedForTermTotal)
    const pupilTotal = termTotalResult.termTotal
    const selectedCount = termTotalResult.selectedSubjects.length
    const overallScore = selectedCount > 0 ? Math.round(pupilTotal / selectedCount) : null

    // Class average: compute total for every learner in the same grade, then average
    const gradeLearnerTotals: number[] = []
    const learnersInGrade = new Set<string>()
    for (const m of allScoresByAssessment.values()) {
      for (const lid of Array.from(m.keys())) learnersInGrade.add(lid)
    }
    for (const lid of Array.from(learnersInGrade)) {
      let lTotal = 0
      let lCount = 0
      for (const aList of Array.from(bySubject.values())) {
        const subScores: number[] = []
        for (const tc of TYPE_COLUMNS) {
          const a = aList.find((x: any) => x.type === tc.type)
          if (a) {
            const v = allScoresByAssessment.get(a.id)?.get(lid) ?? null
            if (v !== null) subScores.push(normalizeTo150(v, a.max_score || 100))
          }
        }
        if (subScores.length > 0) {
          lTotal += subScores.reduce((a, b) => a + b, 0) / subScores.length
          lCount++
        }
      }
      if (lCount > 0) gradeLearnerTotals.push(lTotal)
    }
    const classAverage = gradeLearnerTotals.length > 0
      ? Math.round(gradeLearnerTotals.reduce((a, b) => a + b, 0) / gradeLearnerTotals.length)
      : null

    // Best and worst subjects (among those with a recorded termAverage)
    const subjectsWithScores = subjectReports.filter((s) => s.termAverage !== null)
    let bestSubject: string | null = null
    let worstSubject: string | null = null
    if (subjectsWithScores.length > 0) {
      const sorted = [...subjectsWithScores].sort((a, b) => (b.termAverage || 0) - (a.termAverage || 0))
      bestSubject = sorted[0]?.subject.name || null
      worstSubject = sorted[sorted.length - 1]?.subject.name || null
    }

    // Auto-generate teacher comment
    const teacherComment = autoTeacherComment(learner.name, overallScore, bestSubject, worstSubject)

    // Grading scale — raw scores out of 150 (6-grade A-F scale)
    const gradingScale = GRADING_SCALE.map((g) => ({
      grade: g.grade, range: g.range, remark: g.remark,
    }))

    return NextResponse.json({
      school: schoolDetails,
      class: { name: className, grade: learner.grade, teacherName },
      learner: { id: learner.id, name: learner.name, email: learner.email, grade: learner.grade },
      term: term ? Number(term) : null,
      subjects: subjectReports,
      summary: {
        termTotal: Math.round(pupilTotal),       // canonical name per spec
        pupilTotal: Math.round(pupilTotal),      // kept for backwards-compat with old UI
        termTotalRule: termTotalResult.rule,
        termTotalSelected: termTotalResult.selectedSubjects,
        termTotalDropped: termTotalResult.droppedSubjects,
        classAverage,
        overallScore,  // out of 150 — no percentages
        overallGrade: gradeForScore(overallScore),
        subjectsWithScores: subjectsWithScores.length,
        totalSubjects: subjectReports.length,
      },
      teacherComment,
      gradingScale,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
