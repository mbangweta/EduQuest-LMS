import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { STANDARD_SUBJECTS, normalizeTo150, computeTermTotal } from '@/lib/assessment-utils'

// ============================================================================
// GET /api/gamification?classId=...
// Returns:
//   leaderboard: [{ learnerId, name, avatarColor, points, badges, rank }]
//   badges: all available badge definitions
//
// Points are computed from:
//   - Assessment scores (normalized to /150, summed)
//   - Attendance rate bonus (rate * 2)
//   - Assignment completion bonus
//
// Badges are awarded based on:
//   - ACADEMIC_STAR: highest total in class
//   - PERFECT_ATTENDANCE: 100% attendance rate
//   - GOOD_ATTENDANCE: ≥95% attendance rate
//   - HIGH_ACHIEVER: total ≥ 800 (out of 900)
//   - RISING_STAR: total ≥ 600
//   - DILIGENT: submitted all assignments
//   - MOST_IMPROVED: (placeholder — needs historical data)
// ============================================================================

const BADGE_DEFINITIONS = [
  { code: 'ACADEMIC_STAR',  label: 'Academic Star',       icon: '🏆', color: '#f59e0b', description: 'Highest total score in class' },
  { code: 'HIGH_ACHIEVER',  label: 'High Achiever',        icon: '⭐', color: '#3b82f6', description: 'Total score ≥ 800/900' },
  { code: 'RISING_STAR',    label: 'Rising Star',          icon: '🌟', color: '#8b5cf6', description: 'Total score ≥ 600/900' },
  { code: 'PERFECT_ATTEND', label: 'Perfect Attendance',   icon: '✅', color: '#10b981', description: '100% attendance rate' },
  { code: 'GOOD_ATTEND',    label: 'Good Attendance',      icon: '📅', color: '#06b6d4', description: '≥95% attendance rate' },
  { code: 'DILIGENT',       label: 'Diligent Student',     icon: '📚', color: '#ec4899', description: 'Submitted all assignments' },
  { code: 'CONSISTENT',     label: 'Consistent',           icon: '🎯', color: '#f97316', description: 'No grade below D in any subject' },
]

export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    // Verify access
    const { data: cls } = await sb.from('classes')
      .select('id, school_id, teacher_id, grade').eq('id', classId).maybeSingle()
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
      const { data: tca } = await sb.from('teacher_class_assignments')
        .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
      if (!tca) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Roster
    const { data: members } = await sb.from('class_members').select(`
      learner_id, learner:profiles(id, name, grade, avatar_color)
    `).eq('class_id', classId)
    const roster = (members || []).map((m: any) => m.learner).filter(Boolean)
    if (roster.length === 0) {
      return NextResponse.json({ leaderboard: [], badges: BADGE_DEFINITIONS })
    }

    const learnerIds = roster.map((l: any) => l.id)

    // Subjects
    const allCodes = STANDARD_SUBJECTS.map((s) => s.code)
    const { data: dbSubjects } = await sb.from('subjects')
      .select('id, code').in('code', allCodes)
    const subjectIdByCode = new Map<string, string>()
    for (const s of (dbSubjects || [])) subjectIdByCode.set(String(s.code).toUpperCase(), s.id)

    // Assessments (END_OF_TERM)
    const subjectIds = Array.from(subjectIdByCode.values())
    const { data: assessments } = await sb.from('assessments')
      .select('id, type, max_score, subject_id')
      .eq('class_id', classId)
      .in('subject_id', subjectIds)
      .in('type', ['END_OF_TERM', 'MIDTERM'])

    const assessmentByCode = new Map<string, { id: string; maxScore: number }>()
    for (const std of STANDARD_SUBJECTS) {
      const subjId = subjectIdByCode.get(std.code.toUpperCase())
      if (!subjId) continue
      const matching = (assessments || []).filter((a: any) => a.subject_id === subjId)
      if (matching.length === 0) continue
      const chosen = matching.find((a: any) => a.type === 'END_OF_TERM') || matching[0]
      assessmentByCode.set(std.code, { id: chosen.id, maxScore: Number(chosen.max_score) || 150 })
    }

    // Scores
    const chosenAssessmentIds = Array.from(assessmentByCode.values()).map((a) => a.id)
    let scoreRows: any[] = []
    if (chosenAssessmentIds.length > 0) {
      const { data: sr } = await sb.from('assessment_scores')
        .select('assessment_id, learner_id, score')
        .in('assessment_id', chosenAssessmentIds).in('learner_id', learnerIds)
      scoreRows = sr || []
    }
    const scoreMap = new Map<string, Map<string, number>>()
    for (const s of scoreRows) {
      if (s.score === null || s.score === undefined) continue
      const inner = scoreMap.get(s.assessment_id) ?? new Map<string, number>()
      inner.set(s.learner_id, Number(s.score))
      scoreMap.set(s.assessment_id, inner)
    }

    // Attendance
    const { data: attRecords } = await sb.from('attendance')
      .select('learner_id, status').eq('class_id', classId)
    const attByLearner = new Map<string, { present: number; total: number }>()
    for (const r of (attRecords || [])) {
      const cur = attByLearner.get(r.learner_id) ?? { present: 0, total: 0 }
      if (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED') cur.present++
      cur.total++
      attByLearner.set(r.learner_id, cur)
    }

    // Assignment submissions
    const { data: assignments } = await sb.from('assignments')
      .select('id').eq('class_id', classId).eq('status', 'PUBLISHED')
    const assignmentIds = (assignments || []).map((a: any) => a.id)
    let subCountByLearner = new Map<string, number>()
    if (assignmentIds.length > 0) {
      const { data: subs } = await sb.from('assignment_submissions')
        .select('learner_id').in('assignment_id', assignmentIds).in('learner_id', learnerIds)
      for (const s of (subs || [])) {
        subCountByLearner.set(s.learner_id, (subCountByLearner.get(s.learner_id) ?? 0) + 1)
      }
    }
    const totalAssignments = assignmentIds.length

    // Compute per-learner points + badges
    const leaderboard = roster.map((learner: any) => {
      const normalizedByCode: Array<{ code: string; score: number | null }> = []
      for (const std of STANDARD_SUBJECTS) {
        const aInfo = assessmentByCode.get(std.code)
        if (!aInfo) { normalizedByCode.push({ code: std.code, score: null }); continue }
        const raw = scoreMap.get(aInfo.id)?.get(learner.id) ?? null
        normalizedByCode.push({ code: std.code, score: raw !== null ? normalizeTo150(raw, aInfo.maxScore) : null })
      }
      const gradeNum = learner.grade ?? cls.grade ?? 5
      const termTotalResult = computeTermTotal(gradeNum, normalizedByCode)
      const total = termTotalResult.termTotal

      // Attendance
      const att = attByLearner.get(learner.id)
      const attRate = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null

      // Assignment completion
      const subCount = subCountByLearner.get(learner.id) ?? 0
      const assignmentRate = totalAssignments > 0 ? Math.round((subCount / totalAssignments) * 100) : null

      // Points = total score + attendance bonus + assignment bonus
      const points = (total ?? 0) + (attRate ? attRate * 2 : 0) + (assignmentRate ? assignmentRate * 3 : 0)

      // Award badges
      const badges: string[] = []
      if (total !== null && total >= 800) badges.push('HIGH_ACHIEVER')
      if (total !== null && total >= 600) badges.push('RISING_STAR')
      if (attRate === 100) badges.push('PERFECT_ATTEND')
      if (attRate !== null && attRate >= 95) badges.push('GOOD_ATTEND')
      if (totalAssignments > 0 && subCount === totalAssignments) badges.push('DILIGENT')
      // CONSISTENT: no subject with grade F
      const hasF = normalizedByCode.some((s) => s.score !== null && s.score < 75)
      if (total !== null && !hasF) badges.push('CONSISTENT')

      return {
        learnerId: learner.id,
        name: learner.name,
        avatarColor: learner.avatar_color,
        total,
        attendanceRate: attRate,
        assignmentRate,
        points,
        badges,
        rank: 0 as number,  // assigned below
      }
    })

    // Sort by points desc
    leaderboard.sort((a, b) => b.points - a.points)

    // Assign ranks (standard competition ranking)
    let prevPoints: number | null = null
    let prevRank = 0
    leaderboard.forEach((l, i) => {
      if (prevPoints === null || l.points !== prevPoints) {
        prevRank = i + 1
        prevPoints = l.points
      }
      l.rank = prevRank
    })

    // Award ACADEMIC_STAR to the top learner
    if (leaderboard.length > 0 && leaderboard[0].total !== null) {
      leaderboard[0].badges.push('ACADEMIC_STAR')
    }

    return NextResponse.json({
      leaderboard,
      badges: BADGE_DEFINITIONS,
      classGrade: cls.grade,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    console.error('[api/gamification]', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
