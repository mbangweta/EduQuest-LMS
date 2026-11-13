import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import * as XLSX from 'xlsx'

// POST /api/assessments/[id]/scores/import
// Accepts multipart/form-data with a `file` field (.xlsx/.xls/.csv).
// Parses the file, matches rows to learners (by learner_id preferred, name fallback),
// and bulk-upserts scores. Returns a per-row summary.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'])
    const { id } = await ctx.params
    const sb = supabaseService()

    // Fetch the assessment for auth + max_score
    const { data: a } = await sb.from('assessments')
      .select('id, school_id, teacher_id, max_score, title, class_id, grade')
      .eq('id', id).maybeSingle()
    if (!a) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    if (user.role === 'TEACHER' && a.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'SCHOOL_ADMIN' && a.school_id !== user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      return NextResponse.json({ error: `Failed to parse file: ${e?.message || 'unknown error'}` }, { status: 400 })
    }
    if (rows.length === 0) return NextResponse.json({ error: 'File has no rows' }, { status: 400 })
    if (rows.length < 2) return NextResponse.json({ error: 'File has only a header row — no learner data' }, { status: 400 })

    // Normalize headers (case-insensitive, strip whitespace)
    const header = rows[0].map((h: any) => String(h || '').trim().toLowerCase())
    const colIdx = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n)
        if (i !== -1) return i
      }
      return -1
    }
    const idI = colIdx('learner_id', 'learnerid', 'id', 'student_id', 'studentid')
    const nameI = colIdx('learner_name', 'learnername', 'name', 'student_name', 'student')
    const scoreI = colIdx('score', 'marks', 'marks_obtained', 'grade') // "grade" is sometimes used
    const remarksI = colIdx('remarks', 'comment', 'comments', 'notes')

    if (scoreI === -1) {
      return NextResponse.json({
        error: 'Could not find a "score" column. Expected columns: learner_name, score, remarks. Found headers: ' + header.join(', '),
      }, { status: 400 })
    }

    // Fetch the roster so we can match by name when learner_id is missing
    let roster: any[] = []
    if (a.class_id) {
      const { data: members } = await sb.from('class_members').select(`
        learner_id,
        learner:profiles(id, name, email)
      `).eq('class_id', a.class_id)
      roster = (members || []).map((m: any) => m.learner).filter(Boolean)
    } else {
      const { data: learners } = await sb.from('profiles')
        .select('id, name, email')
        .eq('role', 'LEARNER').eq('status', 'ACTIVE')
        .eq('school_id', a.school_id).eq('grade', a.grade)
      roster = learners || []
    }
    const rosterById = new Map<string, any>(roster.map((l: any) => [l.id, l]))
    const rosterByName = new Map<string, any>()
    for (const l of roster) {
      const key = (l.name || '').trim().toLowerCase()
      if (key) rosterByName.set(key, l)
    }

    // Fetch existing score rows so we can upsert
    const { data: existing } = await sb.from('assessment_scores')
      .select('id, learner_id').eq('assessment_id', id)
    const existingMap = new Map<string, string>((existing || []).map((s: any) => [s.learner_id, s.id]))

    const maxScore = a.max_score
    const now = new Date().toISOString()

    const resultRows: Array<{
      row: number
      learnerName: string
      score: number | null
      status: 'matched' | 'unmatched' | 'invalid'
      error?: string
    }> = []

    const toInsert: any[] = []
    const toUpdate: any[] = []
    let matched = 0, unmatched = 0, invalid = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every((c: any) => c === null || c === undefined || String(c).trim() === '')) continue

      const rawId = idI !== -1 ? String(row[idI] ?? '').trim() : ''
      const rawName = nameI !== -1 ? String(row[nameI] ?? '').trim() : ''
      const rawScore = scoreI !== -1 ? String(row[scoreI] ?? '').trim() : ''
      const rawRemarks = remarksI !== -1 ? String(row[remarksI] ?? '').trim() : ''

      // Match learner
      let learner: any = null
      if (rawId && rosterById.has(rawId)) {
        learner = rosterById.get(rawId)
      } else if (rawName) {
        const key = rawName.toLowerCase()
        if (rosterByName.has(key)) {
          learner = rosterByName.get(key)
        }
      }

      if (!learner) {
        unmatched++
        resultRows.push({ row: i + 1, learnerName: rawName || '(no name)', score: null, status: 'unmatched', error: 'Learner not found in class roster' })
        continue
      }

      // Parse score — empty is OK (means "not yet recorded")
      let score: number | null = null
      if (rawScore !== '') {
        const n = Number(rawScore)
        if (Number.isNaN(n)) {
          invalid++
          resultRows.push({ row: i + 1, learnerName: learner.name, score: null, status: 'invalid', error: `"${rawScore}" is not a number` })
          continue
        }
        if (n < 0 || n > maxScore) {
          invalid++
          resultRows.push({ row: i + 1, learnerName: learner.name, score: null, status: 'invalid', error: `Score ${n} is out of range (0–${maxScore})` })
          continue
        }
        score = Math.round(n * 100) / 100
      }

      matched++
      resultRows.push({ row: i + 1, learnerName: learner.name, score, status: 'matched' })

      const existingId = existingMap.get(learner.id)
      if (existingId) {
        toUpdate.push({
          id: existingId,
          score,
          remarks: rawRemarks || null,
          recorded_by: user.id,
          recorded_at: score !== null ? now : null,
        })
      } else {
        toInsert.push({
          assessment_id: id,
          learner_id: learner.id,
          score,
          remarks: rawRemarks || null,
          recorded_by: user.id,
          recorded_at: score !== null ? now : null,
        })
      }
    }

    // Apply
    if (toInsert.length > 0) {
      const { error: insErr } = await sb.from('assessment_scores').insert(toInsert)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
    for (const u of toUpdate) {
      const { error: updErr } = await sb.from('assessment_scores')
        .update({
          score: u.score,
          remarks: u.remarks,
          recorded_by: u.recorded_by,
          recorded_at: u.recorded_at,
        }).eq('id', u.id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      total: resultRows.length,
      matched,
      unmatched,
      invalid,
      inserted: toInsert.length,
      updated: toUpdate.length,
      rows: resultRows,
    })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
