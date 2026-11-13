'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Plus, Pencil, Trash2, Search, Loader2, Users, UploadCloud, Download,
  CheckCircle2, XCircle,
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { EmptyState } from '@/components/views/shared/empty-state'
import { useRealtimeQuery } from '@/hooks/use-realtime-query'

const learnerSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().optional(),
  grade: z.string().optional(),
  class_code: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']),
})
type LearnerValues = z.infer<typeof learnerSchema>

const CSV_TEMPLATE = `name,email,password,grade,phone,class_code
Thabo Mwansa,thabo2@eduquest.zm,eduquest123,7,,
Chipo Banda,chipo2@eduquest.zm,eduquest123,7,,G7MATH-2025-ABC
`

export function SchoolAdminLearnersView() {
  const { user } = useCurrentUser()
  const { params, navigate } = useRouter()
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCsv, setBulkCsv] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResult, setBulkResult] = useState<any | null>(null)

  // Create form state (firstName + lastName + grade — email and password are auto-generated)
  const [createFirstName, setCreateFirstName] = useState('')
  const [createLastName, setCreateLastName] = useState('')
  const [createGrade, setCreateGrade] = useState('')
  const [createClassCode, setCreateClassCode] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string; name: string } | null>(null)

  const form = useForm<LearnerValues>({
    resolver: zodResolver(learnerSchema),
    defaultValues: { name: '', email: '', password: '', grade: '', class_code: '', status: 'ACTIVE' },
  })

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('role', 'LEARNER')
    if (gradeFilter !== 'ALL') p.set('grade', gradeFilter)
    if (query) p.set('q', query)
    return p.toString()
  }, [gradeFilter, query])

  const { data, isLoading, refetch } = useRealtimeQuery<{ users: any[] }>({
    queryKey: ['users', qs],
    queryFn: () => api.get(`/api/users?${qs}`),
    table: 'profiles',
    event: '*',
  })

  // Open bulk import automatically if navigated with ?bulk=1
  useEffect(() => {
    if (params.bulk === '1') {
      setBulkOpen(true)
      setBulkResult(null)
      setBulkCsv('')
      // Clear the param so it doesn't reopen on next refresh
      navigate('school-admin.learners', {})
    }
  }, [params.bulk])

  const learners = (data?.users ?? []).filter((u) => u.role === 'LEARNER')

  const filtered = useMemo(() => {
    if (!query) return learners
    const q = query.toLowerCase()
    return learners.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [learners, query])

  function openCreate() {
    setEditing(null)
    setCreateFirstName('')
    setCreateLastName('')
    setCreateGrade('')
    setCreateClassCode('')
    setCreatedInfo(null)
    setDialogOpen(true)
  }
  function openEdit(u: any) {
    setEditing(u)
    form.reset({
      name: u.name,
      email: u.email,
      password: '',
      grade: u.grade ? String(u.grade) : '',
      class_code: '',
      status: u.status,
    })
    setDialogOpen(true)
  }

  async function submitCreate() {
    if (!createFirstName.trim() || !createLastName.trim()) {
      toast.error('First name and last name are required')
      return
    }
    if (!user?.schoolId) { toast.error('No school assigned'); return }
    setCreateSubmitting(true)
    try {
      const payload: any = {
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        role: 'LEARNER',
        schoolId: user.schoolId,
      }
      if (createGrade) payload.grade = Number(createGrade)
      const res = await api.post<any>('/api/users', payload)
      toast.success(`Learner created — ${res.generatedEmail || 'email auto-generated'}`)
      setCreatedInfo({
        email: res.generatedEmail || '',
        password: res.generatedPassword || 'eduquest123',
        name: `${createFirstName.trim()} ${createLastName.trim()}`,
      })
      // Enroll in class if class code provided
      if (createClassCode.trim() && res.user?.id) {
        try {
          const { data: classRow } = await fetch(`/api/classes/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classCode: createClassCode.trim(), userId: res.user.id }),
          }).then((r) => r.json())
        } catch {}
      }
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create learner')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function onSubmit(values: LearnerValues) {
    if (!user?.schoolId) {
      toast.error('No school assigned to your account')
      return
    }
    try {
      const payload: any = {
        name: values.name,
        email: values.email,
        role: 'LEARNER',
        status: values.status,
        schoolId: user.schoolId,
      }
      if (values.grade) payload.grade = Number(values.grade)
      if (values.password) payload.password = values.password
      if (editing) {
        if (!values.password) delete payload.password
        await api.patch(`/api/users/${editing.id}`, payload)
        toast.success('Learner updated')
      }
      setDialogOpen(false)
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    }
  }

  async function toggleStatus(u: any) {
    try {
      await api.patch(`/api/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
      toast.success(u.status === 'ACTIVE' ? 'Learner disabled' : 'Learner enabled')
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/users/${toDelete}`)
      toast.success('Learner deleted')
      setToDelete(null)
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'eduquest-learner-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function submitBulk() {
    if (!bulkCsv.trim()) {
      toast.error('Paste a CSV first')
      return
    }
    if (!user?.schoolId) {
      toast.error('No school assigned to your account')
      return
    }
    setBulkSubmitting(true)
    setBulkResult(null)
    try {
      const res = await api.post<{ total: number; succeeded: number; failed: number; results: any[] }>(
        '/api/users/bulk-import',
        { csv: bulkCsv, schoolId: user.schoolId },
      )
      setBulkResult(res)
      if (res.succeeded > 0) {
        toast.success(`Imported ${res.succeeded} of ${res.total} learners`)
        refetch()
      } else {
        toast.error('No learners imported — see results below')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Import failed')
    } finally {
      setBulkSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Learners</h1>
          <p className="text-sm text-muted-foreground">Manage learners in {user?.schoolName || 'your school'}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResult(null); setBulkCsv('') }}>
            <UploadCloud className="mr-2 h-4 w-4" /> Bulk Import
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Learner
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All grades</SelectItem>
              {Array.from({ length: 4 }).map((_, i) => (
                <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No learners found"
              description="Try a different filter, or add a new learner."
              action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Learner</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Learner</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={u.name} color={u.avatarColor} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{u.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.grade ? <Badge variant="secondary">Grade {u.grade}</Badge> : '—'}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => toggleStatus(u)} className="inline-flex">
                          <Badge variant={u.status === 'ACTIVE' ? 'default' : 'outline'} className="cursor-pointer">
                            {u.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(u.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Learner' : 'Add Learner'}</DialogTitle>
            <DialogDescription>
              {editing ? `Editing ${editing.email}. Leave password blank to keep unchanged.` : `Enter first name, last name, and grade. Email and password are auto-generated.`}
            </DialogDescription>
          </DialogHeader>

          {createdInfo && !editing ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-accent">Learner created successfully!</p>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {createdInfo.name}</div>
                  <div><span className="text-muted-foreground">Email:</span> <code className="font-mono">{createdInfo.email}</code></div>
                  <div><span className="text-muted-foreground">Password:</span> <code className="font-mono">{createdInfo.password}</code></div>
                </div>
                <p className="text-xs text-muted-foreground">The learner can change their password after logging in.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setCreatedInfo(null) }}>Close</Button>
                <Button onClick={() => { setCreatedInfo(null); openCreate() }}>Add another</Button>
              </div>
            </div>
          ) : editing ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...form.register('name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="grade">Grade</Label>
                  <Select value={form.watch('grade') ?? ''} onValueChange={(v) => form.setValue('grade', v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password (blank = unchanged)</Label>
                  <Input id="password" type="password" {...form.register('password')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DISABLED">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>Save changes</Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name *</Label>
                  <Input id="firstName" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)} placeholder="Thabo" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name *</Label>
                  <Input id="lastName" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)} placeholder="Mumba" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="grade">Grade *</Label>
                  <Select value={createGrade} onValueChange={setCreateGrade}>
                    <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="classCode">Class code (optional)</Label>
                  <Input id="classCode" value={createClassCode} onChange={(e) => setCreateClassCode(e.target.value)} placeholder="G7PM-2025" />
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p>Email: <code className="font-mono text-foreground">
                  {createFirstName && createLastName
                    ? `${createFirstName.toLowerCase()}.${createLastName.toLowerCase().replace(/\s+/g, '')}@eduquest.zm`
                    : 'firstname.lastname@eduquest.zm'}
                </code></p>
                <p>Password: <code className="font-mono text-foreground">eduquest123</code></p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={!createFirstName.trim() || !createLastName.trim() || !createGrade || createSubmitting}
                  onClick={submitCreate}
                >
                  {createSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create learner
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" /> Bulk Import Learners
            </DialogTitle>
            <DialogDescription>
              Paste a CSV with a header row. Columns: <code>name, email, password, role, grade, phone, class_code</code>.
              Required: <code>name</code>, <code>email</code>. Password defaults to <code>eduquest123</code>.
              All imported learners will be added to <strong>{user?.schoolName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-csv">CSV content</Label>
              <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Download template
              </Button>
            </div>
            <Textarea
              id="bulk-csv"
              rows={8}
              className="font-mono text-xs"
              placeholder={CSV_TEMPLATE}
              value={bulkCsv}
              onChange={(e) => setBulkCsv(e.target.value)}
            />
            {bulkResult && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Succeeded: <strong>{bulkResult.succeeded}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Failed: <strong>{bulkResult.failed}</strong>
                    </span>
                    <span className="text-muted-foreground">Total rows: {bulkResult.total}</span>
                  </div>
                  {bulkResult.results?.length > 0 && (
                    <div className="max-h-48 overflow-y-auto scroll-thin border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Row</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkResult.results.map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{r.row}</TableCell>
                              <TableCell className="text-xs truncate max-w-40">{r.email}</TableCell>
                              <TableCell>
                                <Badge variant={r.success ? 'default' : 'destructive'}>
                                  {r.success ? 'OK' : 'Fail'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.error ?? '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Close</Button>
            <Button onClick={submitBulk} disabled={bulkSubmitting}>
              {bulkSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete learner?"
        description="This will permanently delete the learner and all related data. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
