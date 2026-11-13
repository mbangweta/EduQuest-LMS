'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Upload, Loader2, FileSpreadsheet, XCircle, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * ClassEnrollmentButtons — renders "Download Template" and "Upload Roster" buttons.
 * Shared between the teacher and school-admin class detail views.
 *
 * Download generates a blank Excel template with the columns needed for learner
 * enrollment:
 *   First Name | Last Name | Email (optional) | Grade | Phone (optional) | Password (optional)
 *
 * Upload parses the filled Excel and creates + enrolls learners in the class.
 */
export function ClassEnrollmentButtons({
  classId,
  className,
  classGrade,
}: {
  classId: string
  className: string
  classGrade: number
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  function downloadTemplate() {
    const data = [
      { 'First Name': '', 'Last Name': '', 'Email (optional)': '', 'Grade': classGrade, 'Phone (optional)': '', 'Password (optional)': '' },
    ]
    const ws = XLSX.utils.json_to_sheet(data, {
      header: ['First Name', 'Last Name', 'Email (optional)', 'Grade', 'Phone (optional)', 'Password (optional)'],
    })
    ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 8 }, { wch: 18 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Learners')
    const safeName = (className || 'class').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
    XLSX.writeFile(wb, `${safeName}-enrollment-template.xlsx`)
    toast.success('Template downloaded — fill in learner names and upload it back')
  }

  async function handleUpload(file: File) {
    if (!classId) return
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/classes/${classId}/members/bulk-import`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        return
      }
      setResult(data)
      toast.success(
        `${data.created} created, ${data.enrolled} enrolled${data.errors ? `, ${data.errors} errors` : ''}`
      )
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      // Trigger a reload of the class data
      window.dispatchEvent(new CustomEvent('class-members-updated'))
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" variant="outline" onClick={downloadTemplate} disabled={importing}>
        <Download className="mr-1.5 h-3.5 w-3.5" /> Enrollment Template
      </Button>
      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
        {importing
          ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Importing…</>
          : <><Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Roster</>}
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

      {result && (
        <div className="w-full mt-2 rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="font-medium">Enrollment complete</span>
              {result.created > 0 && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {result.created} created
                </Badge>
              )}
              {result.enrolled > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {result.enrolled} enrolled
                </Badge>
              )}
              {result.existing > 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {result.existing} already existed
                </Badge>
              )}
              {result.errors > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {result.errors} errors
                </Badge>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>Dismiss</Button>
          </div>
          {result.results && result.results.filter((r: any) => r.status === 'error').length > 0 && (
            <div className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
              <div className="text-muted-foreground font-medium">Errors:</div>
              {result.results.filter((r: any) => r.status === 'error').map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-3 w-3 shrink-0 text-red-500" />
                  <span>Row {r.row}: <span className="font-medium text-foreground">{r.name}</span> — {r.error}</span>
                </div>
              ))}
            </div>
          )}
          {result.results && result.results.filter((r: any) => r.status === 'created' || r.status === 'enrolled').length > 0 && (
            <div className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
              <div className="text-muted-foreground font-medium">Successfully enrolled:</div>
              {result.results.filter((r: any) => r.status === 'created' || r.status === 'enrolled').slice(0, 10).map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span>{r.name} — {r.email}</span>
                </div>
              ))}
              {result.results.filter((r: any) => r.status === 'created' || r.status === 'enrolled').length > 10 && (
                <div className="text-muted-foreground italic">…and {result.results.filter((r: any) => r.status === 'created' || r.status === 'enrolled').length - 10} more</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
