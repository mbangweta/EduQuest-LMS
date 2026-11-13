'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, Search, UserPlus, Loader2, Users, Phone, BookOpen, ClipboardList } from 'lucide-react'

import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

const teacherSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']),
})
type TeacherValues = z.infer<typeof teacherSchema>

export function SchoolAdminTeachersView() {
  const { user } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState<any | null>(null)  // teacher being assigned
  const [assignClasses, setAssignClasses] = useState<any[]>([])
  const [assignSelected, setAssignSelected] = useState<Record<string, boolean>>({})
  const [assignSaving, setAssignSaving] = useState(false)

  // Create form state
  const [createFirstName, setCreateFirstName] = useState('')
  const [createLastName, setCreateLastName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string; name: string } | null>(null)

  const form = useForm<TeacherValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { name: '', email: '', password: '', phone: '', status: 'ACTIVE' },
  })

  const { data, isLoading, refetch } = useRealtimeQuery<{ users: any[] }>({
    queryKey: ['users', 'TEACHER', user?.schoolId ?? ''],
    queryFn: () => api.get('/api/users?role=TEACHER'),
    table: 'profiles',
    event: '*',
  })

  const teachers = (data?.users ?? []).filter((u) => u.role === 'TEACHER')

  const filtered = useMemo(() => {
    if (!query) return teachers
    const q = query.toLowerCase()
    return teachers.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [teachers, query])

  function openCreate() {
    setEditing(null)
    setCreateFirstName('')
    setCreateLastName('')
    setCreatePhone('')
    setCreatedInfo(null)
    setDialogOpen(true)
  }
  function openEdit(u: any) {
    setEditing(u)
    form.reset({
      name: u.name, email: u.email, password: '', phone: u.phone ?? '', status: u.status,
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
        role: 'TEACHER',
        schoolId: user.schoolId,
      }
      if (createPhone) payload.phone = createPhone
      const res = await api.post<any>('/api/users', payload)
      toast.success(`Teacher created — ${res.generatedEmail || 'email auto-generated'}`)
      setCreatedInfo({
        email: res.generatedEmail || '',
        password: res.generatedPassword || 'eduquest123',
        name: `${createFirstName.trim()} ${createLastName.trim()}`,
      })
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create teacher')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function onSubmit(values: TeacherValues) {
    if (!user?.schoolId) { toast.error('No school assigned'); return }
    try {
      const payload: any = {
        name: values.name, email: values.email, role: 'TEACHER',
        phone: values.phone || undefined, status: values.status, schoolId: user.schoolId,
      }
      if (values.password) payload.password = values.password
      if (editing) {
        if (!values.password) delete payload.password
        await api.patch(`/api/users/${editing.id}`, payload)
        toast.success('Teacher updated')
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
      toast.success(u.status === 'ACTIVE' ? 'Teacher disabled' : 'Teacher enabled')
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/users/${toDelete}`)
      toast.success('Teacher deleted')
      setToDelete(null)
      refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    }
  }

  async function openAssign(teacher: any) {
    setAssignOpen(teacher)
    setAssignSaving(false)
    try {
      const [classesRes, assignmentsRes] = await Promise.all([
        api.get<{ classes: any[] }>('/api/classes'),
        api.get<{ assignments: any[] }>(`/api/teacher-class-assignments?teacherId=${teacher.id}`),
      ])
      // Classes visible to SCHOOL_ADMIN include all classes in their school (RLS allows it)
      setAssignClasses(classesRes.classes)
      const sel: Record<string, boolean> = {}
      for (const a of assignmentsRes.assignments) sel[a.class_id] = true
      setAssignSelected(sel)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load classes')
    }
  }

  async function saveAssign() {
    if (!assignOpen) return
    setAssignSaving(true)
    try {
      const initial = new Set(Object.keys(assignSelected).filter((k) => assignSelected[k]))
      const updates: Promise<any>[] = []
      for (const c of assignClasses) {
        const wasSelected = !!assignSelected[c.id]
        // We don't know initial state directly anymore — instead, do optimistic upsert/delete
        if (wasSelected) {
          // Upsert assignment (idempotent)
          updates.push(
            api.post('/api/teacher-class-assignments', { teacherId: assignOpen.id, classId: c.id }).catch(() => {})
          )
        } else {
          // Delete assignment if exists
          updates.push(
            api.del(`/api/teacher-class-assignments?teacherId=${assignOpen.id}&classId=${c.id}`).catch(() => {})
          )
        }
      }
      await Promise.all(updates)
      void initial
      toast.success(`Class assignments updated for ${assignOpen.name}`)
      setAssignOpen(null)
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setAssignSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="text-sm text-muted-foreground">Manage teachers in {user?.schoolName || 'your school'}.</p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Teacher
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers…"
              className="pl-9 max-w-md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No teachers found"
              description="Add your first teacher to get started."
              action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Teacher</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Phone</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground">
                        {u.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span> : '—'}
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
                        <Button variant="ghost" size="sm" onClick={() => openAssign(u)}>
                          <ClipboardList className="mr-1 h-4 w-4" /> Assign Classes
                        </Button>
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

      {/* Add/Edit teacher dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle>
            <DialogDescription>
              {editing ? `Editing ${editing.email}. Leave password blank to keep unchanged.` : 'Enter first name and last name. Email and password are auto-generated.'}
            </DialogDescription>
          </DialogHeader>

          {createdInfo && !editing ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-accent">Teacher created successfully!</p>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {createdInfo.name}</div>
                  <div><span className="text-muted-foreground">Email:</span> <code className="font-mono">{createdInfo.email}</code></div>
                  <div><span className="text-muted-foreground">Password:</span> <code className="font-mono">{createdInfo.password}</code></div>
                </div>
                <p className="text-xs text-muted-foreground">The teacher can change their password after logging in.</p>
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
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" {...form.register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password (blank = unchanged)</Label>
                <Input id="password" type="password" {...form.register('password')} />
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
                  <Input id="firstName" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)} placeholder="Siya" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name *</Label>
                  <Input id="lastName" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)} placeholder="Mwansa" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="createPhone">Phone (optional)</Label>
                <Input id="createPhone" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="+260..." />
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
                  disabled={!createFirstName.trim() || !createLastName.trim() || createSubmitting}
                  onClick={submitCreate}
                >
                  {createSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create teacher
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Classes dialog */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Assign Classes
            </DialogTitle>
            <DialogDescription>
              {assignOpen ? `Pick which classes ${assignOpen.name} should teach.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto scroll-thin">
            {assignClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No classes available.</p>
            ) : assignClasses.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-accent/30 cursor-pointer"
              >
                <Checkbox
                  checked={!!assignSelected[c.id]}
                  onCheckedChange={(v) => setAssignSelected((s) => ({ ...s, [c.id]: !!v }))}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Badge variant="secondary">Grade {c.grade}</Badge>
                    <span>{c.subject?.name ?? '—'}</span>
                    {c.teacher && <span className="text-muted-foreground/70">· owner: {c.teacher.name}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button onClick={saveAssign} disabled={assignSaving}>
              {assignSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete teacher?"
        description="This will permanently delete the teacher. Fails if the teacher still owns classes — reassign those first."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
