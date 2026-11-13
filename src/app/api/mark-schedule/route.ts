import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { normalizeTo150, gradeForScore, STANDARD_SUBJECTS } from '@/lib/assessment-utils'

// ============================================================================
// GET /api/mark-schedule?classId=...&term=...&grade=...
// ----------------------------------------------------------------------------
// Returns a Zambian-standard mark schedule matrix:
//
//   {
//     subjects: STANDARD_SUBJECTS,        // always 10 subjects, in fixed order
//     roster:   [...],
//     rows: [
//       {
//         learner: { id, name, email, avatarColor },
//         scoresBySubject: { MATH: number|null, ENG: number|null, ... }, // raw score
//         recordedCount,
//         averageScore,  // out of 150 (no percentages)
//         grade,
//         rank
//       }
//     ],
//     assessments: [...]   // backward-compat / debugging
//   }
//
// The score for each subject cell is the latest END_OF_TERM assessment score
// for that class (or grade) + term + subject. If `term` is 'ALL'/absent, the
// latest END_OF_TERM assessment (any term) is used per subject.
//
// All 10 standard subjects always appear as columns, even if the DB `subjects`
// table is empty. Missing subjects are auto-created on the fly so the matrix
// never collapses to "No assessments" just because the seed SQL wasn't run.
// ============================================================================
export async function GET(req: Request) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const sb = supabaseService()
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const termParam = url.searchParams.get('term')
    const grade = url.searchParams.get('grade')

    if (!classId && !grade) {
      return NextResponse.json({ error: 'classId or grade is required' }, { status: 400 })
    }

    // ---------- 1. Roster ----------
    let roster: any[] = []
    let schoolId: string | undefined = user.schoolId ?? undefined
    let classGrade: number | undefined
    if (classId) {
      const { data: cls } = await sb.from('classes')
        .select('id, school_id, teacher_id, name, grade, subject_id')
        .eq('id', classId).maybeSingle()
      if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
      if (user.role === 'TEACHER' && cls.teacher_id !== user.id) {
        // Allow teachers explicitly co-assigned to this class
        const { data: tca } = await sb.from('teacher_class_assignments')
          .select('id').eq('teacher_id', user.id).eq('class_id', classId).maybeSingle()
        if (!tca) {
          return NextResponse.json({ error: 'Forbidden — you do not teach this class' }, { status: 403 })
        }
      }
      if (user.role === 'SCHOOL_ADMIN' && cls.school_id !== user.schoolId) {
        return NextResponse.json({ error: 'Forbidden — class not in your school' }, { status: 403 })
      }
      schoolId = cls.school_id || user.schoolId
      classGrade = cls.grade
      const { data: members } = await sb.from('class_members').select(`
        learner_id,
        learner:profiles(id, name, email, grade, avatar_color)
      `).eq('class_id', classId)
      roster = (members || []).map((m: any) => m.learner).filter(Boolean)
    } else if (grade) {
      if (!user.schoolId && user.role !== 'SUPER_USER') {
        return NextResponse.json({ error: 'No school assigned' }, { status: 403 })
      }
      classGrade = Number(grade)
      const { data: learners } = await sb.from('profiles')
        .select('id, name, email, grade, avatar_color')
        .eq('role', 'LEARNER').eq('status', 'ACTIVE')
        .eq('school_id', schoolId).eq('grade', Number(grade))
      roster = learners || []
    }
    roster.sort((x: any, y: any) => (x.name || '').localeCompare(y.name || ''))

    if (roster.length === 0) {
      return NextResponse.json({
        subjects: STANDARD_SUBJECTS,
        roster: [],
        rows: [],
        assessments: [],
      })
    }

    // ---------- 2. Resolve subject codes → subject_ids (auto-create missing) ----
    const allCodes = STANDARD_SUBJECTS.map((s) => s.code)
    const { data: dbSubjects } = await sb.from('subjects')
      .select('id, code, name, color').in('code', allCodes)
    const subjectIdByCode = new Map<string, { id: string; name: string; color: string }>()
    for (const s of (dbSubjects || [])) {
      subjectIdByCode.set(String(s.code).toUpperCase(), {
        id: s.id, name: s.name, color: s.color || '',
      })
    }
    // Auto-create any missing standard subjects
    const missingCodes = allCodes.filter((c) => !subjectIdByCode.has(c.toUpperCase()))
    if (missingCodes.length > 0) {
      const stdRows = missingCodes
        .map((code) => STANDARD_SUBJECTS.find((s) => s.code === code))
        .filter(Boolean) as Array<{ code: string; name: string; color: string }>
      if (stdRows.length > 0) {
        const toInsert = stdRows.map((s) => ({
          code: s.code, name: s.name, description: s.name, color: s.color,
        }))
        const { data: inserted } = await sb.from('subjects')
          .insert(toInsert).select('id, code, name, color')
        if (inserted) {
          for (const s of inserted) {
            subjectIdByCode.set(String(s.code).toUpperCase(), {
              id: s.id, name: s.name, color: s.color || '',
            })
          }
        }
      }
    }

    // ---------- 3. Pull END_OF_TERM / MIDTERM assessments for this class/grade ----
    const subjectIdsPresent = Array.from(subjectIdByCode.values()).map((s) => s.id)
    let aq = sb.from('assessments').select(`
      id, title, type, term, max_score, weight, date, status, subject_id, class_id, grade
    `).in('subject_id', subjectIdsPresent)
    if (classId) {
      aq = aq.eq('class_id', classId)
    } else if (classGrade != null) {
      aq = aq.eq('grade', classGrade)
    }
    aq = aq.in('type', ['END_OF_TERM', 'MIDTERM'])
    if (termParam && termParam !== 'ALL') {
      aq = aq.eq('term', Number(termParam))
    }
    if (user.role === 'TEACHER') aq = aq.eq('teacher_id', user.id)
    if (user.role === 'SCHOOL_ADMIN' && schoolId) aq = aq.eq('school_id', schoolId)
    aq = aq.order('date', { ascending: false })

    const { data: assessments, error: aErr } = await aq
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

    // For each subject code, pick the END_OF_TERM assessment (latest by date).
    // Fall back to MIDTERM if no END_OF_TERM exists.
    const assessmentByCode = new Map<string, {
      id: string; title: string; maxScore: number; term: number; type: string
    }>()
    for (const std of STANDARD_SUBJECTS) {
      const subjInfo = subjectIdByCode.get(std.code.toUpperCase())
      if (!subjInfo) continue
      const matching = (assessments || []).filter((a: any) => a.subject_id === subjInfo.id)
      if (matching.length === 0) continue
      const chosen = matching.find((a: any) => a.type === 'END_OF_TERM') || matching[0]
      assessmentByCode.set(std.code, {
        id: chosen.id,
        title: chosen.title,
        maxScore: Number(chosen.max_score) || 150,
        term: Number(chosen.term),
        type: chosen.type,
      })
    }

    // ---------- 4. Pull scores for those assessments ----------
    const chosenAssessmentIds = Array.from(assessmentByCode.values()).map((a) => a.id)
    let scoreRows: any[] = []
    if (chosenAssessmentIds.length > 0) {
      const { data: sr } = await sb.from('assessment_scores')
        .select('assessment_id, learner_id, score, remarks')
        .in('assessment_id', chosenAssessmentIds)
      scoreRows = sr || []
    }
    // Build { [assessmentId]: { [learnerId]: rawScore } }
    const scoreByAssessmentLearner = new Map<string, Map<string, number>>()
    for (const s of scoreRows) {
      if (s.score === null || s.score === undefined) continue
      const inner = scoreByAssessmentLearner.get(s.assessment_id) ?? new Map<string, number>()
      inner.set(s.learner_id, Number(s.score))
      scoreByAssessmentLearner.set(s.assessment_id, inner)
    }

    // ---------- 5. Build per-learner rows ----------
    // Build the subjects list to return (always 10, with assessment info if present)
    const subjectColumns = STANDARD_SUBJECTS.map((std) => {
      const subjInfo = subjectIdByCode.get(std.code.toUpperCase())
      const aInfo = assessmentByCode.get(std.code)
      return {
        code: std.code,
        name: subjInfo?.name || std.name,
        color: subjInfo?.color || std.color,
        subjectId: subjInfo?.id ?? null,
        assessmentId: aInfo?.id ?? null,
        maxScore: aInfo?.maxScore ?? 150,
        title: aInfo?.title ?? std.name,
        type: aInfo?.type ?? null,
        term: aInfo?.term ?? null,
      }
    })

    const rows = roster.map((learner: any) => {
      const scoresBySubject: Record<string, number | null> = {}
      let totalNormalized = 0
      let recorded = 0

      for (const std of STANDARD_SUBJECTS) {
        const aInfo = assessmentByCode.get(std.code)
        if (!aInfo) {
          scoresBySubject[std.code] = null
          continue
        }
        const inner = scoreByAssessmentLearner.get(aInfo.id)
        const raw = inner?.get(learner.id) ?? null
        scoresBySubject[std.code] = raw
        if (raw !== null) {
          const norm = normalizeTo150(raw, aInfo.maxScore)
          totalNormalized += norm
          recorded += 1
        }
      }

      const averageScore = recorded > 0 ? Math.round(totalNormalized / recorded) : null
      return {
        learner: {
          id: learner.id, name: learner.name, email: learner.email, avatarColor: learner.avatar_color,
        },
        scoresBySubject,
        recordedCount: recorded,
        total: recorded > 0 ? totalNormalized : null,
        averageScore,
        grade: gradeForScore(averageScore),
      }
    })

    // ---------- 6. Rank by average desc (only learners with ≥1 recorded score) ----------
    const ranked = rows
      .filter((r: any) => r.averageScore !== null)
      .sort((a: any, b: any) => (b.averageScore - a.averageScore))
    ranked.forEach((r: any, i: number) => { (r as any).rank = i + 1 })
    const rankMap = new Map<string, number>()
    for (const r of ranked) rankMap.set(r.learner.id, (r as any).rank)
    for (const r of rows) (r as any).rank = rankMap.get(r.learner.id) ?? null

    let classInfo: any = null
    if (classId) {
      const { data: cData } = await sb.from('classes').select('id, name, grade').eq('id', classId).maybeSingle()
      classInfo = cData
    }

    return NextResponse.json({
      class: classInfo,
      roster,
      subjects: subjectColumns,
      rows,
      // Backward-compat / debugging — expose the resolved assessments
      assessments: Array.from(assessmentByCode.values()).map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        term: a.term,
        maxScore: a.maxScore,
      })),
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    console.error('[api/mark-schedule]', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
