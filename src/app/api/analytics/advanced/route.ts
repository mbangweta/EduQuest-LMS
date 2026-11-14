import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { STANDARD_SUBJECTS, normalizeTo150, computeTermTotal, gradeForScore, GRADING_SCALE } from '@/lib/assessment-utils'

// ============================================================================
// GET /api/analytics/advanced?classId=...&term=...
// ----------------------------------------------------------------------------
// Returns comprehensive analytics for a class (or the whole school):
//   atRiskLearners, subjectPerformance, gradeDistribution, classAverage,
//   attendanceSummary, topPerformers, bottomPerformers
// ============================================================================
export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const termParam = url.searchParams.get('term')
    const grade = url.searchParams.get('grade')

    let roster: any[] = []
    let classGrade: number | undefined
    let classInfo: any = null

    if (classId) {
      const { data: cls } = await sb.from('classes')
        .select('id, school_id, teacher_id, name, grade')
        .eq('id', classId).maybeSingle()
      if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
      if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
        const { data: tca } = await sb.from('teacher_class_assignments')
          .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
        if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      classGrade = cls.grade
      classInfo = cls
      const { data: members } = await sb.from('class_members').select(`
        learner_id, learner:profiles(id, name, grade, avatar_color)
      `).eq('class_id', classId)
      roster = (members || []).map((m: any) => m.learner).filter(Boolean)
    } else if (user.role === 'SUPER_USER' || user.role === 'SCHOOL_ADMIN') {
      const schoolId = user.schoolId
      let rq = sb.from('profiles').select('id, name, grade, avatar_color')
        .eq('role', 'LEARNER').eq('status', 'ACTIVE')
      if (user.role === 'SCHOOL_ADMIN') rq = rq.eq('school_id', schoolId)
      if (grade) rq = rq.eq('grade', Number(grade))
      const { data: learners } = await rq
      roster = learners || []
    } else {
      const { data: myClasses } = await sb.from('classes').select('id').eq('teacher_id', user.id)
      const classIds = (myClasses || []).map((c: any) => c.id)
      if (classIds.length === 0) {
        return NextResponse.json({ atRiskLearners: [], subjectPerformance: [], gradeDistribution: {}, classAverage: null, totalLearners: 0 })
      }
      const { data: members } = await sb.from('class_members').select(`
        learner_id, learner:profiles(id, name, grade, avatar_color)
      `).in('class_id', classIds)
      roster = (members || []).map((m: any) => m.learner).filter(Boolean)
    }

    if (roster.length === 0) {
      return NextResponse.json({
        atRiskLearners: [], subjectPerformance: [], gradeDistribution: {},
        classAverage: null, totalLearners: 0,
        attendanceSummary: { present: 0, absent: 0, late: 0, excused: 0, rate: null },
        topPerformers: [], bottomPerformers: [],
      })
    }

    const learnerIds = roster.map((l: any) => l.id)
    const allCodes = STANDARD_SUBJECTS.map((s) => s.code)
    const { data: dbSubjects } = await sb.from('subjects')
      .select('id, code, name, color').in('code', allCodes)
    const subjectIdByCode = new Map<string, string>()
    for (const s of (dbSubjects || [])) subjectIdByCode.set(String(s.code).toUpperCase(), s.id)

    const subjectIds = Array.from(subjectIdByCode.values())
    let aq = sb.from('assessments').select(`
      id, title, type, term, max_score, subject_id, class_id, grade, school_id
    `).in('subject_id', subjectIds).in('type', ['END_OF_TERM', 'MIDTERM'])
    if (classId) aq = aq.eq('class_id', classId)
    else if (classGrade != null) aq = aq.eq('grade', classGrade)
    if (termParam && termParam !== 'ALL') aq = aq.eq('term', Number(termParam))
    if (user.role === 'TEACHER') aq = aq.eq('teacher_id', user.id)
    if (user.role === 'SCHOOL_ADMIN' && user.schoolId) aq = aq.eq('school_id', user.schoolId)
    const { data: assessments } = await aq

    const assessmentByCode = new Map<string, { id: string; maxScore: number }>()
    for (const std of STANDARD_SUBJECTS) {
      const subjId = subjectIdByCode.get(std.code.toUpperCase())
      if (!subjId) continue
      const matching = (assessments || []).filter((a: any) => a.subject_id === subjId)
      if (matching.length === 0) continue
      const chosen = matching.find((a: any) => a.type === 'END_OF_TERM') || matching[0]
      assessmentByCode.set(std.code, { id: chosen.id, maxScore: Number(chosen.max_score) || 150 })
    }

    const chosenAssessmentIds = Array.from(assessmentByCode.values()).map((a) => a.id)
    let scoreRows: any[] = []
    if (chosenAssessmentIds.length > 0) {
      const { data: sr } = await sb.from('assessment_scores')
        .select('assessment_id, learner_id, score')
        .in('assessment_id', chosenAssessmentIds).in('learner_id', learnerIds)
      scoreRows = sr || []
    }
    const scoreByAssessmentLearner = new Map<string, Map<string, number>>()
    for (const s of scoreRows) {
      if (s.score === null || s.score === undefined) continue
      const inner = scoreByAssessmentLearner.get(s.assessment_id) ?? new Map<string, number>()
      inner.set(s.learner_id, Number(s.score))
      scoreByAssessmentLearner.set(s.assessment_id, inner)
    }

    // Attendance
    let attendanceByLearner = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>()
    if (classId) {
      const { data: attRecords } = await sb.from('attendance')
        .select('learner_id, status').eq('class_id', classId)
      for (const r of (attRecords || [])) {
        const cur = attendanceByLearner.get(r.learner_id) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
        if (r.status === 'PRESENT') cur.present++
        else if (r.status === 'ABSENT') cur.absent++
        else if (r.status === 'LATE') cur.late++
        else if (r.status === 'EXCUSED') cur.excused++
        cur.total++
        attendanceByLearner.set(r.learner_id, cur)
      }
    }

    const learnerTotals: Array<{ learnerId: string; name: string; avatarColor?: string; total: number | null; attendanceRate: number | null; scoresBySubject: Record<string, number | null> }> = []

    for (const learner of roster) {
      const scoresBySubject: Record<string, number | null> = {}
      const normalizedByCode: Array<{ code: string; score: number | null }> = []
      for (const std of STANDARD_SUBJECTS) {
        const aInfo = assessmentByCode.get(std.code)
        if (!aInfo) { scoresBySubject[std.code] = null; normalizedByCode.push({ code: std.code, score: null }); continue }
        const raw = scoreByAssessmentLearner.get(aInfo.id)?.get(learner.id) ?? null
        scoresBySubject[std.code] = raw
        normalizedByCode.push({ code: std.code, score: raw !== null ? normalizeTo150(raw, aInfo.maxScore) : null })
      }
      const gradeNum = learner.grade ?? classGrade ?? 5
      const termTotalResult = computeTermTotal(gradeNum, normalizedByCode)
      const att = attendanceByLearner.get(learner.id)
      const attRate = att && att.total > 0 ? Math.round(((att.present + att.late + att.excused) / att.total) * 100) : null
      learnerTotals.push({ learnerId: learner.id, name: learner.name, avatarColor: learner.avatar_color, total: termTotalResult.termTotal, attendanceRate: attRate, scoresBySubject })
    }

    // At-risk
    const atRiskLearners = learnerTotals
      .filter((l) => (l.total !== null && l.total < 400) || (l.attendanceRate !== null && l.attendanceRate < 70))
      .map((l) => {
        const reasons: string[] = []
        if (l.total !== null && l.total < 400) reasons.push('Low academic performance')
        if (l.attendanceRate !== null && l.attendanceRate < 70) reasons.push(`Poor attendance (${l.attendanceRate}%)`)
        return { learnerId: l.learnerId, name: l.name, avatarColor: l.avatarColor, total: l.total, attendanceRate: l.attendanceRate, reasons }
      })
      .sort((a, b) => (a.total ?? 999) - (b.total ?? 999))

    // Subject performance
    const subjectPerformance = STANDARD_SUBJECTS.map((std) => {
      const scores: number[] = []
      for (const l of learnerTotals) {
        const v = l.scoresBySubject[std.code]
        if (v !== null && v !== undefined) {
          const aInfo = assessmentByCode.get(std.code)
          scores.push(aInfo ? normalizeTo150(v, aInfo.maxScore) : v)
        }
      }
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
      const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
      for (const s of scores) { const g = gradeForScore(s); if (dist[g] !== undefined) dist[g]++ }
      return { code: std.code, name: std.name, color: std.color, avgScore: avg, learnerCount: scores.length, gradeDistribution: dist }
    })

    // Overall grade distribution
    const overallDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
    for (const l of learnerTotals) {
      if (l.total === null) continue
      const avg = Math.round(l.total / 6)
      const g = gradeForScore(avg)
      if (overallDist[g] !== undefined) overallDist[g]++
    }

    const totalsOnly = learnerTotals.filter((l) => l.total !== null).map((l) => l.total as number)
    const classAverage = totalsOnly.length > 0 ? Math.round(totalsOnly.reduce((a, b) => a + b, 0) / totalsOnly.length) : null

    const sortedByTotal = [...learnerTotals].filter((l) => l.total !== null).sort((a, b) => (b.total as number) - (a.total as number))
    const topPerformers = sortedByTotal.slice(0, 5).map((l) => ({ learnerId: l.learnerId, name: l.name, total: l.total, avatarColor: l.avatarColor }))
    const bottomPerformers = sortedByTotal.slice(-5).reverse().map((l) => ({ learnerId: l.learnerId, name: l.name, total: l.total, avatarColor: l.avatarColor }))

    let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalExcused = 0, totalAttRecords = 0
    for (const att of attendanceByLearner.values()) {
      totalPresent += att.present; totalAbsent += att.absent; totalLate += att.late; totalExcused += att.excused; totalAttRecords += att.total
    }
    const attendanceSummary = {
      present: totalPresent, absent: totalAbsent, late: totalLate, excused: totalExcused,
      rate: totalAttRecords > 0 ? Math.round(((totalPresent + totalLate + totalExcused) / totalAttRecords) * 100) : null,
    }

    return NextResponse.json({
      class: classInfo, atRiskLearners, subjectPerformance, gradeDistribution: overallDist,
      classAverage, totalLearners: roster.length, learnersWithScores: totalsOnly.length,
      attendanceSummary, topPerformers, bottomPerformers, gradingScale: GRADING_SCALE,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    console.error('[api/analytics/advanced]', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
