import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { normalizeTo150, gradeForScore, STANDARD_SUBJECTS } from '@/lib/assessment-utils'

// GET /api/learner/my-scores — return the current learner's own scores across all subjects.
// Optionally filter by term.
export async function GET(req: Request) {
  try {
    const user = await requireUser(['LEARNER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const term = url.searchParams.get('term')

    // All PUBLISHED assessments for this learner's school + grade
    let aq = sb.from('assessments').select(`
      id, title, type, term, max_score, weight, date, status, subject_id, grade, class_id, school_id,
      subject:subjects(id, name, code, color),
      class:classes(id, name)
    `).eq('grade', user.grade).eq('status', 'PUBLISHED')
    if (user.schoolId) aq = aq.eq('school_id', user.schoolId)
    if (term) aq = aq.eq('term', Number(term))
    const { data: assessments, error: aErr } = await aq
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

    // Filter to assessments where the learner is enrolled in the class (if class_id is set)
    // or assessments with no class_id (grade-wide).
    const classIdsInAssessments = (assessments || [])
      .map((a: any) => a.class_id).filter(Boolean) as string[]
    let enrolledClassIds = new Set<string>()
    if (classIdsInAssessments.length > 0) {
      const { data: myMemberships } = await sb.from('class_members')
        .select('class_id').eq('learner_id', user.id).in('class_id', classIdsInAssessments)
      enrolledClassIds = new Set((myMemberships || []).map((m: any) => m.class_id))
    }
    const visibleAssessments = (assessments || []).filter((a: any) =>
      !a.class_id || enrolledClassIds.has(a.class_id)
    )

    const assessmentIds = visibleAssessments.map((a: any) => a.id)
    let myScores: any[] = []
    if (assessmentIds.length > 0) {
      const { data: sRows } = await sb.from('assessment_scores')
        .select('assessment_id, score, remarks, recorded_at')
        .eq('learner_id', user.id).in('assessment_id', assessmentIds)
      myScores = sRows || []
    }
    const scoreMap = new Map<string, any>()
    for (const s of myScores) scoreMap.set(s.assessment_id, s)

    // Group by subject
    const bySubject = new Map<string, any[]>()
    for (const a of visibleAssessments) {
      const list = bySubject.get(a.subject_id) ?? []
      list.push(a)
      bySubject.set(a.subject_id, list)
    }

    const subjectSummaries = Array.from(bySubject.entries()).map(([subjectId, aList]) => {
      const subject = aList[0].subject
      let totalNormalized = 0
      let totalWeight = 0
      let recorded = 0
      const assessmentsWithScores = aList.map((a: any) => {
        const s = scoreMap.get(a.id)
        const score = s?.score === null || s?.score === undefined ? null : Number(s.score)
        if (score !== null) {
          const norm = normalizeTo150(score, a.max_score)
          totalNormalized += norm * Number(a.weight)
          totalWeight += Number(a.weight)
          recorded++
        }
        return {
          id: a.id,
          title: a.title,
          type: a.type,
          term: a.term,
          date: a.date,
          maxScore: a.max_score,
          weight: Number(a.weight),
          score,
          remarks: s?.remarks ?? null,
          recordedAt: s?.recorded_at ?? null,
        }
      })
      const avgScore = totalWeight > 0 ? Math.round(totalNormalized / totalWeight) : null
      return {
        subject: subject ? { id: subject.id, name: subject.name, code: subject.code, color: subject.color } : { id: subjectId, name: 'Subject' },
        assessments: assessmentsWithScores,
        recordedCount: recorded,
        averageScore: avgScore,  // out of 150 (no percentages)
        grade: gradeForScore(avgScore),
      }
    }).sort((a, b) => (a.subject.name || '').localeCompare(b.subject.name || ''))

    // Ensure ALL 10 standard subjects appear, even if they have no assessments.
    const standardCodes = STANDARD_SUBJECTS.map((s) => s.code)
    const { data: standardSubjectRows } = await sb.from('subjects')
      .select('id, name, code, color').in('code', standardCodes)
    const standardByCode = new Map<string, any>()
    for (const s of (standardSubjectRows || [])) {
      standardByCode.set(String(s.code).toUpperCase(), s)
    }
    for (const std of STANDARD_SUBJECTS) {
      const subjectRow = standardByCode.get(std.code)
      if (!subjectRow) continue
      const alreadyIncluded = subjectSummaries.some((ss: any) => ss.subject.code?.toUpperCase() === std.code)
      if (!alreadyIncluded) {
        subjectSummaries.push({
          subject: { id: subjectRow.id, name: subjectRow.name, code: subjectRow.code, color: subjectRow.color },
          assessments: [],
          recordedCount: 0,
          averageScore: null,
          grade: '—',
        })
      }
    }
    // Sort by the standard subject order
    const codeOrder = STANDARD_SUBJECTS.map((s) => s.code.toUpperCase())
    subjectSummaries.sort((a: any, b: any) => {
      const ai = codeOrder.indexOf((a.subject.code || '').toUpperCase())
      const bi = codeOrder.indexOf((b.subject.code || '').toUpperCase())
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })

    return NextResponse.json({
      learner: { id: user.id, name: user.name, grade: user.grade },
      term: term ? Number(term) : null,
      subjectSummaries,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
