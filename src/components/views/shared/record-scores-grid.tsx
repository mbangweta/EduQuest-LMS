'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Loader2, AlertCircle, Award } from 'lucide-react'
import { api } from '@/lib/api-client'
import { STANDARD_SUBJECTS } from '@/lib/assessment-utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface ScoreCell {
  score: string
  originalScore: string
  assessmentId: string | null
}

interface LearnerRow {
  learnerId: string
  learnerName: string
  cells: Record<string, ScoreCell>
}

/**
 * RecordScoresGrid — editable grid showing all 10 standard subjects as columns.
 *
 * Columns: # | Learner | Mathematics | English | Science | ... | Expressive Arts | Total | Position
 * - # = row number (1, 2, 3...)
 * - Each subject column has an editable score input
 * - Total = auto-calculated sum of all subject scores for that learner
 * - Position = auto-calculated rank in class (by total, descending)
 */
export function RecordScoresGrid({ classId, grade }: { classId: string; grade: number }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [rows, setRows] = useState<LearnerRow[]>([])
  const [term, setTerm] = useState('1')
  const [maxScore, setMaxScore] = useState('100')

  useEffect(() => {
    if (!classId) return
    setLoading(true)
    Promise.all([
      api.get<{ members: any[] }>(`/api/classes/${classId}/members`),
      api.get<{ subjects: any[] }>('/api/subjects'),
    ]).then(([mRes, sRes]) => {
      const rosterList = (mRes.members || [])
        .filter((m: any) => m.role === 'LEARNER' || m.learner)
        .map((m: any) => m.learner ?? m)
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
      setRoster(rosterList)
      const standardCodes = STANDARD_SUBJECTS.map((s) => s.code)
      const subjMap = new Map<string, any>()
      for (const s of (sRes.subjects || [])) {
        if (standardCodes.includes(s.code)) subjMap.set(s.code, s)
      }
      const orderedSubjects = STANDARD_SUBJECTS.map((s) => subjMap.get(s.code)).filter(Boolean)
      setSubjects(orderedSubjects)
      setRows(rosterList.map((learner: any) => ({
        learnerId: learner.id,
        learnerName: learner.name,
        cells: {},
      })))
      loadScores(classId, Number(term), rosterList, orderedSubjects)
    }).catch((e: any) => {
      toast.error(e?.message || 'Failed to load')
    }).finally(() => setLoading(false))
  }, [classId])

  async function loadScores(cid: string, t: number, rosterList: any[], subjList: any[]) {
    try {
      // No status filter — teachers must also see their DRAFT assessments here.
      const params = new URLSearchParams({ classId: cid, term: String(t) })
      const { assessments } = await api.get<{ assessments: any[] }>(`/api/assessments?${params.toString()}`)
      const assessmentIds = assessments.map((a: any) => a.id)
      let scoreMap = new Map<string, Map<string, number | null>>()
      if (assessmentIds.length > 0) {
        for (const a of assessments) {
          if (a.subjectId) {
            const { scores } = await api.get<{ scores: any[] }>(`/api/assessments/${a.id}/scores`)
            const inner = new Map<string, number | null>()
            for (const s of (scores || [])) {
              inner.set(s.learner_id, s.score === null || s.score === undefined ? null : Number(s.score))
            }
            scoreMap.set(a.id, inner)
          }
        }
      }
      setRows(rosterList.map((learner: any) => {
        const cells: Record<string, ScoreCell> = {}
        for (const subj of subjList) {
          // Prefer the END_OF_TERM assessment when a subject has several
          // (e.g. a fortnightly test AND the end-of-term exam).
          const forSubject = assessments.filter((x: any) => x.subjectId === subj.id)
          const a = forSubject.find((x: any) => x.type === 'END_OF_TERM') || forSubject[0]
          if (a) {
            const sc = scoreMap.get(a.id)?.get(learner.id) ?? null
            const scoreStr = sc === null ? '' : String(sc)
            cells[subj.code] = { score: scoreStr, originalScore: scoreStr, assessmentId: a.id }
          } else {
            cells[subj.code] = { score: '', originalScore: '', assessmentId: null }
          }
        }
        return { learnerId: learner.id, learnerName: learner.name, cells }
      }))
    } catch (e: any) {
      console.error('loadScores error:', e)
    }
  }

  function updateCell(learnerId: string, subjectCode: string, value: string) {
    setRows((prev) => prev.map((r) => {
      if (r.learnerId !== learnerId) return r
      return {
        ...r,
        cells: { ...r.cells, [subjectCode]: { ...r.cells[subjectCode], score: value } },
      }
    }))
  }

  // Compute total for each learner (sum of all subject scores)
  function getTotal(row: LearnerRow): number {
    return subjects.reduce((sum, s) => {
      const v = row.cells[s.code]?.score
      if (v === '' || v === undefined) return sum
      const n = Number(v)
      return Number.isNaN(n) ? sum : sum + n
    }, 0)
  }

  // Compute positions (rank by total, descending)
  const rankedRows = [...rows]
    .map((r, idx) => ({ row: r, total: getTotal(r), originalIdx: idx }))
    .sort((a, b) => b.total - a.total)
  const positionMap = new Map<number, number>()
  let currentRank = 0
  let prevTotal = -1
  rankedRows.forEach((r, i) => {
    if (r.total !== prevTotal) {
      currentRank = i + 1
      prevTotal = r.total
    }
    positionMap.set(r.originalIdx, currentRank)
  })

  const dirtyCount = rows.reduce((count, r) => {
    return count + subjects.filter((s) => r.cells[s.code]?.score !== r.cells[s.code]?.originalScore).length
  }, 0)

  async function save() {
    if (dirtyCount === 0) {
      toast.info('No changes to save')
      return
    }
    setSaving(true)
    try {
      const maxScoreNum = Number(maxScore)
      for (const subj of subjects) {
        const dirtyRows = rows.filter((r) => r.cells[subj.code]?.score !== r.cells[subj.code]?.originalScore)
        if (dirtyRows.length === 0) continue
        let assessmentId = dirtyRows[0]?.cells[subj.code]?.assessmentId
        if (!assessmentId) {
          const { assessment } = await api.post<{ assessment: any }>('/api/assessments', {
            title: `${subj.name} — End of Term ${term}`,
            type: 'END_OF_TERM',
            term: Number(term),
            classId,
            grade,
            maxScore: maxScoreNum,
            status: 'PUBLISHED',
            subjectId: subj.id,
          })
          assessmentId = assessment.id
        }
        const scoresToSave = dirtyRows.map((r) => ({
          learnerId: r.learnerId,
          score: r.cells[subj.code].score === '' ? null : Number(r.cells[subj.code].score),
        }))
        await api.put(`/api/assessments/${assessmentId}/scores`, { scores: scoresToSave })
      }
      toast.success(`Saved ${dirtyCount} score change${dirtyCount === 1 ? '' : 's'}`)
      setRows((prev) => prev.map((r) => {
        const newCells: Record<string, ScoreCell> = {}
        for (const code of Object.keys(r.cells)) {
          newCells[code] = { ...r.cells[code], originalScore: r.cells[code].score }
        }
        return { ...r, cells: newCells }
      }))
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  if (roster.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
        No learners enrolled in this class. Add learners first.
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Standard subjects not found in the database. Please contact an administrator.
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Term</Label>
            <Select value={term} onValueChange={(v) => {
              setTerm(v)
              loadScores(classId, Number(v), roster, subjects)
            }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Term 1</SelectItem>
                <SelectItem value="2">Term 2</SelectItem>
                <SelectItem value="3">Term 3</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-xs ml-2">Max Score</Label>
            <Select value={maxScore} onValueChange={setMaxScore}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="150">150</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {dirtyCount} unsaved
              </Badge>
            )}
            <Button size="sm" onClick={save} disabled={saving || dirtyCount === 0}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save Scores</>}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Learner</TableHead>
                {subjects.map((s) => (
                  <TableHead key={s.code} className="text-center min-w-[80px]">
                    <div className="font-medium leading-tight text-xs">{s.name}</div>
                    <div className="text-[9px] text-muted-foreground font-normal">/{maxScore}</div>
                  </TableHead>
                ))}
                <TableHead className="text-center bg-muted/30 min-w-[70px]">Total</TableHead>
                <TableHead className="text-center bg-muted/30 min-w-[70px]">Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => {
                const total = getTotal(r)
                const position = positionMap.get(idx) ?? 0
                return (
                  <TableRow key={r.learnerId} className={idx % 2 === 0 ? 'bg-muted/20' : ''}>
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      {r.learnerName}
                    </TableCell>
                    {subjects.map((s) => {
                      const cell = r.cells[s.code]
                      const scoreNum = cell?.score === '' ? null : Number(cell?.score)
                      const isInvalid = cell?.score !== '' && (Number.isNaN(scoreNum) || (scoreNum as number) < 0 || (scoreNum as number) > Number(maxScore))
                      const isDirty = cell?.score !== cell?.originalScore
                      return (
                        <TableCell key={s.code} className={isDirty ? 'bg-amber-50/50' : ''}>
                          <Input
                            type="number"
                            step="1"
                            min={0}
                            max={maxScore}
                            placeholder="—"
                            value={cell?.score ?? ''}
                            onChange={(e) => updateCell(r.learnerId, s.code, e.target.value)}
                            className={`h-8 w-16 text-center p-1 ${isInvalid ? 'border-destructive' : ''}`}
                          />
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-muted/30 font-bold">
                      {total}
                    </TableCell>
                    <TableCell className="text-center bg-muted/30">
                      {position > 0 && total > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {position === 1 && <Award className="h-3.5 w-3.5 text-amber-500" />}
                          {position}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Enter scores for each subject. Total and Position are calculated automatically. Leave a cell blank to mark as "not yet recorded".
        </p>
      </CardContent>
    </Card>
  )
}
