'use client'

import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Library as LibraryIcon, Upload, FileText, Download, Edit, Trash2, Plus,
  ChevronRight, BookOpen, FileSpreadsheet, Loader2, ExternalLink, Filter,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRouter } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/views/shared/empty-state'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { CreateSubjectDialog } from '@/components/views/shared/create-subject-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type Scope = 'super' | 'school-admin' | 'teacher' | 'learner'

const PAPER_TYPES = [
  { value: 'EXAM', label: 'Past Exam', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'TEST', label: 'Test', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'WORKSHEET', label: 'Worksheet', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'NOTES', label: 'Notes', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'OTHER', label: 'Other', color: 'bg-gray-100 text-gray-800 border-gray-200' },
]

const GRADES = [4, 5, 6, 7]

export function LibraryView({ scope }: { scope: Scope }) {
  const { user } = useCurrentUser()
  const qc = useQueryClient()
  const isSuper = scope === 'super'
  const canUpload = scope === 'super' || scope === 'school-admin' || scope === 'teacher'

  // Navigation state: selected grade → selected subject → filtered resources
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [paperType, setPaperType] = useState<string>('ALL')

  // Fetch resources
  const { data, isLoading } = useQuery<any>({
    queryKey: ['library-resources'],
    queryFn: () => api.get('/api/library'),
    staleTime: 60_000,
  })

  // Fetch subjects
  const { data: subjectsData } = useQuery<any>({
    queryKey: ['subjects'],
    queryFn: () => api.get('/api/subjects'),
    staleTime: 120_000,
  })

  const resources = data?.resources || []
  const subjects = subjectsData?.subjects || []

  // Group resources by grade → subject
  const gradeData = useMemo(() => {
    const filtered = resources.filter((r: any) => {
      if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false
      if (paperType !== 'ALL' && r.paper_type !== paperType) return false
      return true
    })

    const byGrade: Record<number, Record<string, any[]>> = {}
    for (const r of filtered) {
      if (!r.grade) return
      if (!byGrade[r.grade]) byGrade[r.grade] = {}
      const subjId = r.subject?.id || 'none'
      if (!byGrade[r.grade][subjId]) byGrade[r.grade][subjId] = []
      byGrade[r.grade][subjId].push(r)
    }
    return byGrade
  }, [resources, search, paperType])

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', subjectId: '', grade: '4', year: '',
    paperType: 'EXAM', fileUrl: '', fileType: 'pdf', fileSize: 0,
    schoolId: '', status: 'PUBLISHED',
  })
  const [submitting, setSubmitting] = useState(false)
  const [toDelete, setToDelete] = useState<any | null>(null)

  // Fetch schools for super user upload dialog
  const { data: schoolsData } = useQuery<any>({
    queryKey: ['schools'],
    queryFn: () => api.get('/api/schools'),
    enabled: isSuper,
    staleTime: 120_000,
  })
  const schools = schoolsData?.schools || []

  async function upload() {
    if (!form.title || !form.fileUrl) { toast.error('Title and file URL required'); return }
    setSubmitting(true)
    try {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        subjectId: form.subjectId || null,
        grade: Number(form.grade),
        year: form.year ? Number(form.year) : null,
        paperType: form.paperType,
        fileUrl: form.fileUrl,
        fileType: form.fileType || 'pdf',
        fileSize: form.fileSize || null,
        status: form.status,
      }
      if (isSuper && form.schoolId) payload.schoolId = form.schoolId
      await api.post('/api/library', payload)
      toast.success('Resource uploaded')
      setUploadOpen(false)
      setForm({ title: '', description: '', subjectId: '', grade: '4', year: '', paperType: 'EXAM', fileUrl: '', fileType: 'pdf', fileSize: 0, schoolId: '', status: 'PUBLISHED' })
      qc.invalidateQueries({ queryKey: ['library-resources'] })
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteResource() {
    if (!toDelete) return
    try {
      await api.del(`/api/library/${toDelete.id}`)
      toast.success('Resource deleted')
      setToDelete(null)
      qc.invalidateQueries({ queryKey: ['library-resources'] })
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    }
  }

  function getSubjectName(id: string): string {
    const s = subjects.find((s: any) => s.id === id)
    return s?.name || 'General'
  }

  function getSubjectColor(id: string): string {
    const s = subjects.find((s: any) => s.id === id)
    return s?.color || '#2563eb'
  }

  // If a grade is selected, show the subjects for that grade
  if (selectedGrade !== null) {
    const gradeResources = gradeData[selectedGrade] || {}
    const subjectIds = Object.keys(gradeResources)

    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => { setSelectedGrade(null); setSelectedSubjectId(null) }} className="text-muted-foreground hover:text-foreground">
            Library
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Grade {selectedGrade}</span>
          {selectedSubjectId && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{getSubjectName(selectedSubjectId)}</span>
              <button onClick={() => setSelectedSubjectId(null)} className="text-xs text-muted-foreground hover:text-foreground ml-2">
                (back to subjects)
              </button>
            </>
          )}
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={paperType} onValueChange={setPaperType}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {PAPER_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* If a subject is selected, show resources. Otherwise show subject grid */}
        {selectedSubjectId ? (
          // Show resources for this grade + subject
          <div className="space-y-3">
            {(gradeResources[selectedSubjectId] || []).length === 0 ? (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No resources yet"
                description={`No resources found for ${getSubjectName(selectedSubjectId)} in Grade ${selectedGrade}.`}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {(gradeResources[selectedSubjectId] || []).map((r: any) => {
                    const pt = PAPER_TYPES.find((p) => p.value === r.paper_type) || PAPER_TYPES[4]
                    const canEdit = canUpload && (isSuper || r.school_id === user?.schoolId)
                    return (
                      <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <Badge className={pt.color}>{pt.label}</Badge>
                              {r.year && <span className="text-xs text-muted-foreground">{r.year}</span>}
                            </div>
                            <h3 className="font-semibold text-sm mb-1 line-clamp-2">{r.title}</h3>
                            {r.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{r.description}</p>}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                              {r.uploaded_by && <span>by {r.uploaded_by.name}</span>}
                              <span>· {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ''}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => window.open(r.file_url, '_blank')}>
                                <Download className="mr-1 h-3 w-3" /> Download
                              </Button>
                              {canEdit && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => { /* edit */ }}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(r)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : (
          // Show subjects for this grade as cards
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s: any) => {
              const count = (gradeResources[s.id] || []).length
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubjectId(s.id)}
                  className="text-left"
                >
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold shrink-0"
                          style={{ backgroundColor: s.color || '#2563eb' }}
                        >
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{count} resource{count !== 1 ? 's' : ''}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </div>
        )}

        {/* Upload button */}
        {canUpload && (
          <div className="fixed bottom-4 right-4 z-10">
            <Button onClick={() => setUploadOpen(true)} className="shadow-lg">
              <Plus className="mr-2 h-4 w-4" /> Add Resource
            </Button>
          </div>
        )}

        {/* Upload dialog + delete dialog — shared */}
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          form={form}
          setForm={setForm}
          subjects={subjects}
          schools={schools}
          isSuper={isSuper}
          submitting={submitting}
          onSubmit={upload}
        />
        <ConfirmDialog
          open={!!toDelete}
          title="Delete resource?"
          description={`Delete "${toDelete?.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={deleteResource}
          onCancel={() => setToDelete(null)}
        />
      </div>
    )
  }

  // Default view: show grade cards
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LibraryIcon className="h-6 w-6" /> Library
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuper ? 'Platform-wide library' : user?.schoolName || 'School library'}
            {' · '}Past papers, worksheets & notes
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Resource
          </Button>
        )}
      </div>

      {/* Search bar */}
      <Input
        placeholder="Search all resources..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GRADES.map((g) => <Skeleton key={g} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GRADES.map((grade) => {
            const gradeResources = gradeData[grade] || {}
            const totalForGrade = Object.values(gradeResources).reduce((sum: number, arr: any) => sum + arr.length, 0)
            const subjectsInGrade = Object.keys(gradeResources).length
            return (
              <button key={grade} onClick={() => setSelectedGrade(grade)} className="text-left">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
                        {grade}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="font-semibold text-base">Grade {grade}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {totalForGrade} resource{totalForGrade !== 1 ? 's' : ''}{' '}
                      {subjectsInGrade > 0 && `· ${subjectsInGrade} subject${subjectsInGrade !== 1 ? 's' : ''}`}
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      {/* Upload dialog + delete dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        form={form}
        setForm={setForm}
        subjects={subjects}
        schools={schools}
        isSuper={isSuper}
        submitting={submitting}
        onSubmit={upload}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete resource?"
        description={`Delete "${toDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteResource}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

// Shared upload dialog component — simplified: title + choose URL or file upload (PDF only)
function UploadDialog(props: any) {
  const { open, onOpenChange, form, setForm, subjects, schools, isSuper, submitting, onSubmit } = props
  const [addMode, setAddMode] = useState<'url' | 'upload'>('upload')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(file: File | null) {
    if (!file) return
    // Only accept PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      // Upload to Supabase Storage
      const formData = new FormData()
      formData.append('file', file)
      formData.append('defaultPassword', 'eduquest123') // unused but harmless

      // Use the upload endpoint (we'll create this as /api/library/upload)
      const res = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        return
      }
      setForm({
        ...form,
        fileUrl: data.url,
        fileType: 'pdf',
        fileSize: data.size || file.size,
        title: form.title || file.name.replace(/\.pdf$/i, ''),
      })
      toast.success('PDF uploaded — fill in the title and click Add')
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Resource</DialogTitle>
          <DialogDescription>Enter a title and choose how to add the resource file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto scroll-thin">
          {/* Title — the only required field */}
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. ECZ Grade 7 Mathematics Past Paper 2023"
            />
          </div>

          {/* Choose: Upload or URL */}
          <div className="space-y-1.5">
            <Label>How to add the file</Label>
            <div className="flex gap-1 border-b">
              <button
                onClick={() => setAddMode('upload')}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  addMode === 'upload' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Upload PDF
              </button>
              <button
                onClick={() => setAddMode('url')}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  addMode === 'url' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Enter URL
              </button>
            </div>
          </div>

          {/* Upload mode — file picker (PDF only) */}
          {addMode === 'upload' && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5') }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
                  handleFileSelect(e.dataTransfer.files?.[0] ?? null)
                }}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading PDF...</p>
                  </div>
                ) : form.fileUrl ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <div className="text-sm font-medium">PDF uploaded</div>
                      <div className="text-xs text-muted-foreground">{form.fileSize ? `${(form.fileSize / 1024).toFixed(0)} KB` : ''}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setForm({ ...form, fileUrl: '', fileSize: 0 }) }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">Drop a PDF here or click to browse</p>
                    <p className="text-xs text-muted-foreground/70">Only .pdf files accepted</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* URL mode — text input */}
          {addMode === 'url' && (
            <div className="space-y-1.5">
              <Label>File URL *</Label>
              <Input
                value={form.fileUrl}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value, fileType: 'pdf' })}
                placeholder="https://example.com/paper.pdf"
              />
              <p className="text-xs text-muted-foreground">Paste a direct link to a PDF file.</p>
            </div>
          )}

          {/* Optional details — collapsible */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium py-1">
              More details (optional)
            </summary>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Grade</Label>
                  <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Paper type</Label>
                  <Select value={form.paperType} onValueChange={(v) => setForm({ ...form, paperType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAPER_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Year</Label>
                  <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2023" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              {isSuper && schools.length > 0 && (
                <div className="space-y-1.5">
                  <Label>School scope</Label>
                  <Select value={form.schoolId || 'global'} onValueChange={(v) => setForm({ ...form, schoolId: v === 'global' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (all schools)</SelectItem>
                      {schools.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.title || !form.fileUrl || submitting || uploading}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
