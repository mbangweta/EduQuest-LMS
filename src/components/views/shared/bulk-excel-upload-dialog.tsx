'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

interface School { id: string; name: string; code: string }

interface ResultRow { row: number; email: string; success: boolean; error?: string; userId?: string }

// Bulk Excel upload dialog — accepts .xlsx, .xls, .csv files.
export function BulkExcelUploadDialog({
  open, onOpenChange, schools = [], allowSchoolSelect = false, defaultSchoolId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  schools?: School[]
  allowSchoolSelect?: boolean
  defaultSchoolId?: string | null
}) {
  const [file, setFile] = useState<File | null>(null)
  const [schoolId, setSchoolId] = useState<string>(defaultSchoolId || '')
  const [defaultPassword, setDefaultPassword] = useState('eduquest123')
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ total: number; succeeded: number; failed: number; results: ResultRow[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null); setResults(null); setUploading(false)
  }

  function downloadTemplate() {
    const csv = 'name,email,password,role,grade,phone,class_code\n'
      + 'Thabo Mumba,thabo2@eduquest.zm,eduquest123,LEARNER,7,+260977000001,G7PM-2025\n'
      + 'Mrs. Banda,mrs.banda@eduquest.zm,eduquest123,TEACHER,,+260971000099,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'eduquest-bulk-import-template.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function upload() {
    if (!file) return
    setUploading(true)
    setResults(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (allowSchoolSelect && schoolId) formData.append('schoolId', schoolId)
      if (defaultPassword) formData.append('defaultPassword', defaultPassword)
      const res = await fetch('/api/users/bulk-import-excel', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        return
      }
      setResults(data)
      toast.success(`Imported ${data.succeeded} of ${data.total} users`)
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleFileSelect(f: File | null) {
    const validTypes = ['.xlsx', '.xls', '.csv']
    const ext = '.' + (f?.name.split('.').pop() || '').toLowerCase()
    if (f && !validTypes.includes(ext)) {
      toast.error('Please upload an .xlsx, .xls, or .csv file')
      return
    }
    setFile(f)
    setResults(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Bulk Import Users
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file with columns: name, email, password, role, grade, phone, class_code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {allowSchoolSelect && schools.length > 0 && (
            <div className="space-y-1.5">
              <Label>Target school</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Default password (used if "password" column is empty)</Label>
            <input
              type="text" value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              handleFileSelect(e.dataTransfer.files?.[0] ?? null)
            }}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  Drag and drop your Excel file here, or
                </p>
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  Browse files
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="mr-1 h-3 w-3" /> Download template
            </Button>
          </div>

          {results && (
            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <span className="font-medium">Total: {results.total}</span>
                <span className="text-accent font-medium">Succeeded: {results.succeeded}</span>
                {results.failed > 0 && <span className="text-destructive font-medium">Failed: {results.failed}</span>}
              </div>
              <div className="max-h-60 overflow-y-auto scroll-thin border rounded-md">
                <AnimatePresence initial={false}>
                  {results.results.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm border-b last:border-0 ${
                        r.success ? 'bg-accent/5' : 'bg-destructive/5'
                      }`}
                    >
                      {r.success
                        ? <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                      <span className="text-xs text-muted-foreground shrink-0">Row {r.row}</span>
                      <span className="font-medium truncate flex-1">{r.email || '(no email)'}</span>
                      {!r.success && r.error && (
                        <span className="text-xs text-destructive truncate">{r.error}</span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results && (
            <Button onClick={upload} disabled={!file || uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
