'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Save, Loader2, Users, Award, CheckCircle2, AlertCircle, Eye, EyeOff,
  Download, Upload, FileSpreadsheet, XCircle,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface ScoreEntry {
  learnerId: string
  learnerName: string
  score: string // string for input; "" = empty
  remarks: string
  originalScore: string
  originalRemarks: string
}

export function TeacherAssessmentEditorView({ assessmentId }: { assessmentId?: string }) {
  const { navigate } = useRouter()
  const isNew = !assessmentId || assessmentId === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [assessment, setAssessment] = useState<any>(null)
  const [entries, setEntries] = useState<ScoreEntry[]>([])
  const [publishing, setPublishing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew || !assessmentId) return
    api.get<{ assessment: any; roster: any[]; scores: any[] }>(`/api/assessments/${assessmentId}/scores`)
      .then((r) => {
        setAssessment(r.assessment)
        const scoreMap = new Map<string, any>()
        for (const s of r.scores) scoreMap.set(s.learner_id, s)
        setEntries(r.roster.map((learner: any) => {
          const s = scoreMap.get(learner.id)
          const scoreStr = s?.score === null || s?.score === undefined ? '' : String(s.score)
          return {
            learnerId: learner.id,
            learnerName: learner.name,
            score: scoreStr,
            remarks: s?.remarks ?? '',
            originalScore: scoreStr,
            originalRemarks: s?.remarks ?? '',
          }
        }))
      })
      .catch((e: any) => toast.error(e?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [assessmentId])

  const dirtyCount = useMemo(
    () => entries.filter((e) => e.score !== e.originalScore || e.remarks !== e.originalRemarks).length,
    [entries],
  )

  const maxScore = assessment?.maxScore ?? 100
  const recordedCount = entries.filter((e) => e.score !== '' && !Number.isNaN(Number(e.score))).length
  const completionPct = entries.length > 0 ? Math.round((recordedCount / entries.length) * 100) : 0

  function updateEntry(idx: number, patch: Partial<ScoreEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  async function saveScores() {
    if (!assessmentId || isNew) return
    setSaving(true)
    try {
      const scores = entries.map((e) => ({
        learnerId: e.learnerId,
        score: e.score === '' ? null : Number(e.score),
        remarks: e.remarks.trim() || undefined,
      }))
      const r = await api.put<{ inserted: number; updated: number; invalid: number }>(`/api/assessments/${assessmentId}/scores`, { scores })
      toast.success(`Saved — ${r.inserted} new, ${r.updated} updated${r.invalid ? `, ${r.invalid} invalid skipped` : ''}`)
      // Mark all as clean
      setEntries((prev) => prev.map((e) => ({ ...e, originalScore: e.score, originalRemarks: e.remarks })))
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  function downloadTemplate() {
    if (entries.length === 0) {
      toast.error('No learners to include in the template')
      return
    }
    // Build the worksheet with columns: Learner Name, Score, Remarks, Learner ID (do not edit)
    const data = entries.map((e) => ({
      'Learner Name': e.learnerName,
      'Score': '',  // teacher fills in
      'Remarks': '',
      'Learner ID (do not edit)': e.learnerId,
    }))
    const ws = XLSX.utils.json_to_sheet(data, {
      header: ['Learner Name', 'Score', 'Remarks', 'Learner ID (do not edit)'],
    })
    // Set column widths
    ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 30 }, { wch: 38 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Scores')
    const safeTitle = (assessment?.title || 'assessment').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
    const fileName = `${safeTitle}-scores-template.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success('Template downloaded — fill in the Score column and upload it back')
  }

  async function handleFileUpload(file: File) {
    if (!assessmentId || isNew) return
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/assessments/${assessmentId}/scores/import`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        return
      }
      setImportResult(data)
      toast.success(`Imported ${data.matched} of ${data.total} rows (${data.inserted} new, ${data.updated} updated)${data.invalid ? `, ${data.invalid} invalid` : ''}`)
      // Refresh the scores from the server so the grid reflects the import
      await reloadScores()
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function reloadScores() {
    if (!assessmentId || isNew) return
    const r = await api.get<{ roster: any[]; scores: any[] }>(`/api/assessments/${assessmentId}/scores`)
    const scoreMap = new Map<string, any>()
    for (const s of r.scores) scoreMap.set(s.learner_id, s)
    setEntries(r.roster.map((learner: any) => {
      const s = scoreMap.get(learner.id)
      const scoreStr = s?.score === null || s?.score === undefined ? '' : String(s.score)
      return {
        learnerId: learner.id,
        learnerName: learner.name,
        score: scoreStr,
        remarks: s?.remarks ?? '',
        originalScore: scoreStr,
        originalRemarks: s?.remarks ?? '',
      }
    }))
  }

  async function publish() {
    if (!assessmentId || isNew) return
    if (dirtyCount > 0) {
      const ok = confirm(`You have ${dirtyCount} unsaved score change${dirtyCount === 1 ? '' : 's'}. Save before publishing?`)
      if (!ok) return
      await saveScores()
    }
    setPublishing(true)
    try {
      await api.patch(`/api/assessments/${assessmentId}`, { status: 'PUBLISHED' })
      setAssessment((a: any) => ({ ...a, status: 'PUBLISHED' }))
      toast.success('Assessment published — learners can now see their scores')
    } catch (e: any) { toast.error(e?.message || 'Failed to publish') }
    finally { setPublishing(false) }
  }

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>
  }

  if (!assessment) {
    return <div className="p-6 text-center text-muted-foreground">Assessment not found.</div>
  }

  const isPublished = assessment.status === 'PUBLISHED'

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('teacher.assessments')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> All assessments
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveScores} disabled={saving || dirtyCount === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Save scores{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
          </Button>
          {!isPublished && (
            <Button onClick={publish} disabled={publishing}>
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Eye className="mr-2 h-4 w-4" /> Publish
            </Button>
          )}
          {isPublished && (
            <Badge variant="default" className="bg-emerald-100 text-emerald-800 border-emerald-200">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Published
            </Badge>
          )}
        </div>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">{assessment.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Grade {assessment.grade} · Term {assessment.term} · {assessment.subject?.name}
                {assessment.className ? ` · ${assessment.className}` : ' · Grade-wide'}
              </p>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Date</div>
              <div className="font-medium">{assessment.date ? format(new Date(assessment.date), 'dd MMM yyyy') : '—'}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Max score</div>
              <div className="font-semibold text-lg">{assessment.maxScore}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Weight</div>
              <div className="font-semibold text-lg">{assessment.weight}×</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Learners</div>
              <div className="font-semibold text-lg inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {entries.length}
              </div>
            </div>
          </div>
          {isPublished && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 inline-flex items-center gap-2">
              <EyeOff className="h-3.5 w-3.5" /> Published — learners can now see their scores in their "My Scores" view.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score entry table */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold">Record Scores</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{recordedCount} / {entries.length} recorded</span>
                <Progress value={completionPct} className="h-1.5 w-24" />
                <span>{completionPct}%</span>
              </div>
              {entries.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={downloadTemplate} disabled={importing}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Template
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                    {importing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Importing…</> : <><Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Scores</>}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileUpload(f)
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Import results panel */}
          {importResult && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-medium">Import complete</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {importResult.matched} matched
                  </Badge>
                  {importResult.inserted > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {importResult.inserted} new
                    </Badge>
                  )}
                  {importResult.updated > 0 && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      {importResult.updated} updated
                    </Badge>
                  )}
                  {importResult.unmatched > 0 && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      {importResult.unmatched} unmatched
                    </Badge>
                  )}
                  {importResult.invalid > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {importResult.invalid} invalid
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setImportResult(null)}>
                  Dismiss
                </Button>
              </div>
              {(importResult.unmatched > 0 || importResult.invalid > 0) && (
                <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {importResult.rows.filter((r: any) => r.status === 'unmatched' || r.status === 'invalid').map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground">
                      <XCircle className={`h-3 w-3 shrink-0 ${r.status === 'invalid' ? 'text-red-500' : 'text-orange-500'}`} />
                      <span>Row {r.row}: <span className="font-medium text-foreground">{r.learnerName}</span> — {r.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {entries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No learners in this class. Add learners to the class first.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead className="w-40">Score (out of {maxScore})</TableHead>
                    <TableHead className="w-24">%</TableHead>
                    <TableHead className="min-w-[200px]">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e, idx) => {
                    const scoreNum = e.score === '' ? null : Number(e.score)
                    const pct = scoreNum !== null && !Number.isNaN(scoreNum)
                      ? Math.round((scoreNum / maxScore) * 100)
                      : null
                    const isInvalid = e.score !== '' && (Number.isNaN(scoreNum) || (scoreNum as number) < 0 || (scoreNum as number) > maxScore)
                    const isDirty = e.score !== e.originalScore || e.remarks !== e.originalRemarks
                    return (
                      <TableRow key={e.learnerId} className={isDirty ? 'bg-amber-50/40' : ''}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{e.learnerName}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            max={maxScore}
                            placeholder="—"
                            value={e.score}
                            onChange={(ev) => updateEntry(idx, { score: ev.target.value })}
                            className={`h-8 w-32 ${isInvalid ? 'border-destructive' : ''}`}
                          />
                          {isInvalid && (
                            <div className="text-[10px] text-destructive mt-0.5">Must be 0–{maxScore}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {pct === null ? <span className="text-muted-foreground">—</span> : (
                            <Badge variant={pct >= 50 ? 'default' : 'destructive'} className={pct >= 50 ? 'bg-accent text-accent-foreground' : ''}>
                              {pct}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Optional remarks…"
                            value={e.remarks}
                            onChange={(ev) => updateEntry(idx, { remarks: ev.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Award className="h-4 w-4" />
            Tip: leave a score blank to mark as "not yet recorded". The class average and rank will only include recorded scores.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
