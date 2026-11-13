'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Upload, Loader2, FileSpreadsheet, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api-client'
import { STANDARD_SUBJECTS } from '@/lib/assessment-utils'

interface Learner { id: string; name: string }

/**
 * MarkSheetButtons — renders "Download Template" and "Upload Mark Sheet" buttons.
 * Shared between the teacher and school-admin mark schedule views.
 *
 * Download generates an Excel file with the Zambian-standard mark sheet layout:
 *   S/N | NAME | MATH | ENG | SCI | SS | ZL | SP1 | SP2 | TS | HE | EA | TOTAL | POSITION
 * Pre-filled with the class roster. The TOTAL column has a SUM formula per row,
 * and the last row has AVERAGE formulas per subject column.
 *
 * Upload parses the filled Excel and creates END_OF_TERM assessments for each
 * subject + class + term, then bulk-upserts scores.
 */
export function MarkSheetButtons({
  classId,
  className,
  learners,
  term,
}: {
  classId: string
  className: string
  learners: Learner[]
  term: string  // 'ALL' or '1'/'2'/'3'
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  function downloadTemplate() {
    if (learners.length === 0) {
      toast.error('No learners in this class to include in the template')
      return
    }
    const termLabel = term !== 'ALL' ? `Term ${term}` : 'All Terms'
    const safeName = (className || 'class').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)

    // Build header row: S/N | NAME | 10 subjects | TOTAL | POSITION
    const headers = ['S/N', 'NAME', ...STANDARD_SUBJECTS.map((s) => s.label), 'TOTAL', 'POSITION']

    // Build learner rows: S/N pre-filled, name pre-filled, subjects empty, TOTAL formula, POSITION blank
    const dataRows: any[][] = learners.map((l, i) => {
      const rowNum = i + 2 // Excel row number (header is row 1)
      // Subject columns start at column C (index 2) and span 10 columns → C through L
      const firstCol = 'C'
      const lastCol = String.fromCharCode(67 + STANDARD_SUBJECTS.length - 1) // C=67, +10 → L=76
      const totalFormula = { f: `SUM(${firstCol}${rowNum}:${lastCol}${rowNum})` }
      return [i + 1, l.name, ...STANDARD_SUBJECTS.map(() => ''), totalFormula, '']
    })

    // Average row (last row)
    const lastDataRow = dataRows.length + 1
    const avgRow: any[] = ['', 'Average']
    for (let j = 0; j < STANDARD_SUBJECTS.length; j++) {
      // Subject columns start at column C (index 2) → C=67
      const colLetter = String.fromCharCode(67 + j)
      avgRow.push({ f: `IFERROR(AVERAGE(${colLetter}2:${colLetter}${lastDataRow}),0)` })
    }
    avgRow.push('') // TOTAL average — leave blank
    avgRow.push('') // POSITION — leave blank

    const allRows = [headers, ...dataRows, avgRow]
    const ws = XLSX.utils.aoa_to_sheet(allRows)

    // Column widths
    ws['!cols'] = [
      { wch: 6 },   // S/N
      { wch: 32 },  // NAME
      ...STANDARD_SUBJECTS.map(() => ({ wch: 12 })),
      { wch: 10 },  // TOTAL
      { wch: 10 },  // POSITION
    ]
    // Freeze the header row + S/N + NAME columns
    ws['!freeze'] = { xSplit: '2', ySplit: '1', topLeftCell: 'C2', activePane: 'bottomRight', state: 'frozen' }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${termLabel}`.slice(0, 31))
    const fileName = `${safeName}-${termLabel.toLowerCase().replace(/\s+/g, '-')}-mark-sheet.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success(`Template downloaded — ${learners.length} learners, ${STANDARD_SUBJECTS.length} subjects`)
  }

  async function handleUpload(file: File) {
    if (!classId) {
      toast.error('Select a class first')
      return
    }
    const uploadTerm = term !== 'ALL' ? term : '1'
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('classId', classId)
      formData.append('term', uploadTerm)
      const res = await fetch('/api/mark-sheet/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        return
      }
      setImportResult(data)
      const subjCount = data.subjectsProcessed?.length ?? 0
      toast.success(
        `Imported ${data.scoresInserted + data.scoresUpdated} scores across ${subjCount} subjects ` +
        `(${data.learnersMatched} learners matched${data.learnersUnmatched ? `, ${data.learnersUnmatched} unmatched` : ''})`
      )
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function refresh() {
    setImportResult(null)
    // Reload the page data by dispatching a custom event the parent listens for
    window.dispatchEvent(new CustomEvent('mark-sheet-uploaded'))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" variant="outline" onClick={downloadTemplate} disabled={learners.length === 0 || importing}>
        <Download className="mr-1.5 h-3.5 w-3.5" /> Mark Sheet Template
      </Button>
      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!classId || importing}>
        {importing
          ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Importing…</>
          : <><Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Mark Sheet</>}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
        }}
      />

      {importResult && (
        <div className="w-full mt-2 rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="font-medium">Mark sheet imported</span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {importResult.subjectsProcessed?.length ?? 0} subjects
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {importResult.learnersMatched} matched
              </Badge>
              {importResult.scoresInserted > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {importResult.scoresInserted} inserted
                </Badge>
              )}
              {importResult.scoresUpdated > 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {importResult.scoresUpdated} updated
                </Badge>
              )}
              {importResult.learnersUnmatched > 0 && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {importResult.learnersUnmatched} unmatched
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={refresh}>Refresh schedule</Button>
              <Button size="sm" variant="ghost" onClick={() => setImportResult(null)}>Dismiss</Button>
            </div>
          </div>
          {importResult.subjectsSkipped?.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Skipped subjects (not found in database): {importResult.subjectsSkipped.join(', ')}
            </div>
          )}
          {importResult.unmatchedLearners?.length > 0 && (
            <div className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
              <div className="text-muted-foreground font-medium">Unmatched learners (not in class roster):</div>
              {importResult.unmatchedLearners.map((name: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-3 w-3 shrink-0 text-orange-500" />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
