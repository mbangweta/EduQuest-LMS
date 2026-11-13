'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, Search, UserPlus, Loader2, Users, UploadCloud, Download, Globe2, Building2, CheckCircle2, XCircle } from 'lucide-react'

import { api } from '@/lib/api-client'
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

const userSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER']),
  grade: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  schoolId: z.string().optional(),
})
type UserValues = z.infer<typeof userSchema>

const ROLE_LABELS: Record<string, string> = {
  SUPER_USER: 'Super User',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  LEARNER: 'Learner',
  ADMIN: 'Admin',
}

function roleBadgeVariant(role: string): 'destructive' | 'default' | 'secondary' {
  if (role === 'SUPER_USER') return 'destructive'
  if (role === 'SCHOOL_ADMIN') return 'default'
  if (role === 'TEACHER') return 'default'
  return 'secondary'
}

const CSV_TEMPLATE = `name,email,password,role,grade,phone,class_code
Thabo Mwansa,thabo2@eduquest.zm,eduquest123,LEARNER,7,,
Chipo Banda,chipo2@eduquest.zm,eduquest123,LEARNER,7,,G7MATH-2025-ABC
Mr. New Teacher,newteacher@eduquest.zm,eduquest123,TEACHER,,,
`

export function SuperUsersView() {
  const [users, setUsers] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>('ALL')
  const [schoolFilter, setSchoolFilter] = useState<string>('ALL')  // ALL | 'none' | schoolId
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCsv, setBulkCsv] = useState('')
  const [bulkSchool, setBulkSchool] = useState<string>('none')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResult, setBulkResult] = useState<any | null>(null)

  // Create form state (simpler than react-hook-form — just firstName, lastName, role, etc.)
  const [createFirstName, setCreateFirstName] = useState('')
  const [createLastName, setCreateLastName] = useState('')
  const [createRole, setCreateRole] = useState<string>('LEARNER')
  const [createSchoolId, setCreateSchoolId] = useState<string>('')
  const [createGrade, setCreateGrade] = useState<string>('')
  const [createPhone, setCreatePhone] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string; name: string } | null>(null)

  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', role: 'LEARNER', password: '', status: 'ACTIVE', grade: '', phone: '', schoolId: 'none' },
  })

  // Watch role so we can show/hide school select
  const watchedRole = form.watch('role')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (role !== 'ALL') params.set('role', role)
      if (schoolFilter !== 'ALL') params.set('schoolId', schoolFilter)
      if (query) params.set('q', query)
      const { users } = await api.get<{ users: any[] }>(`/api/users${params.toString() ? `?${params}` : ''}`)
      setUsers(users)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // Load schools list (for filters + dialogs) once
  useEffect(() => {
    api.get<{ schools: any[] }>('/api/schools')
      .then((r) => setSchools(r.schools))
      .catch(() => {})
  }, [])

  // Reload users when filters change (debounced search)
  useEffect(() => {
    const t = setTimeout(() => { load() }, 250)
    return () => clearTimeout(t)
  }, [role, schoolFilter])

  // Live updates via realtime
  useRealtimeQuery({
    queryKey: ['users', role, schoolFilter, query],
    queryFn: () => api.get<{ users: any[] }>(`/api/users?role=${role}&schoolId=${schoolFilter}&q=${encodeURIComponent(query)}`),
    table: 'profiles',
    event: '*',
    enabled: true,
  })

  const filtered = useMemo(() => {
    if (!query) return users
    const q = query.toLowerCase()
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [users, query])

  function openCreate() {
    setEditing(null)
    setCreateFirstName('')
    setCreateLastName('')
    setCreateRole('LEARNER')
    setCreateSchoolId(schools[0]?.id ?? '')
    setCreateGrade('')
    setCreatePhone('')
    setCreatedInfo(null)
    setDialogOpen(true)
  }
  function openEdit(u: any) {
    setEditing(u)
    form.reset({
      name: u.name,
      email: u.email,
      role: (['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER'].includes(u.role) ? u.role : 'LEARNER') as any,
      password: '',
      status: u.status,
      grade: u.grade ? String(u.grade) : '',
      phone: u.phone ?? '',
      schoolId: u.schoolId ?? 'none',
    })
    setDialogOpen(true)
  }

  async function submitCreate() {
    if (!createFirstName.trim() || !createLastName.trim()) {
      toast.error('First name and last name are required')
      return
    }
    setCreateSubmitting(true)
    try {
      const payload: any = {
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        role: createRole,
      }
      if (createRole === 'LEARNER' && createGrade) payload.grade = Number(createGrade)
      if (createPhone) payload.phone = createPhone
      if (createRole === 'SUPER_USER') {
        payload.schoolId = null
      } else if (createSchoolId) {
        payload.schoolId = createSchoolId
      }
      const res = await api.post<any>('/api/users', payload)
      toast.success(`User created — ${res.generatedEmail || 'email auto-generated'}`)
      setCreatedInfo({
        email: res.generatedEmail || '',
        password: res.generatedPassword || 'eduquest123',
        name: `${createFirstName.trim()} ${createLastName.trim()}`,
      })
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create user')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function toggleStatus(u: any) {
    try {
      await api.patch(`/api/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
      toast.success(u.status === 'ACTIVE' ? 'User disabled' : 'User enabled')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/users/${toDelete}`)
      toast.success('User deleted')
      setToDelete(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'eduquest-bulk-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function submitBulk() {
    if (!bulkCsv.trim()) {
      toast.error('Paste a CSV first')
      return
    }
    setBulkSubmitting(true)
    setBulkResult(null)
    try {
      const payload: any = { csv: bulkCsv }
      if (bulkSchool && bulkSchool !== 'none') payload.schoolId = bulkSchool
      const res = await api.post<{ total: number; succeeded: number; failed: number; results: any[] }>(
        '/api/users/bulk-import',
        payload,
      )
      setBulkResult(res)
      if (res.succeeded > 0) {
        toast.success(`Imported ${res.succeeded} of ${res.total} users`)
        load()
      } else {
        toast.error('No users imported — see results below')
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
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage super users, school admins, teachers and learners across all schools.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResult(null); setBulkCsv('') }}>
            <UploadCloud className="mr-2 h-4 w-4" /> Bulk Import
          </Button>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" /> Add User
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
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              <SelectItem value="SUPER_USER">Super User</SelectItem>
              <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
              <SelectItem value="TEACHER">Teacher</SelectItem>
              <SelectItem value="LEARNER">Learner</SelectItem>
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All schools</SelectItem>
              <SelectItem value="none">Platform-wide</SelectItem>
              {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No users found"
              description="Try a different filter, or add a new user."
              action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add User</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>School</TableHead>
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
                        <Badge variant={roleBadgeVariant(u.role)}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.role === 'SUPER_USER' && !u.schoolId ? (
                          <Badge variant="outline" className="gap-1">
                            <Globe2 className="h-3 w-3" /> Platform-wide
                          </Badge>
                        ) : u.school ? (
                          <Badge variant="secondary" className="gap-1">
                            <Building2 className="h-3 w-3" /> <span className="truncate max-w-[160px]">{u.school.name}</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{u.grade ? `Grade ${u.grade}` : '—'}</TableCell>
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
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(u.id)}>
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

      {/* Add/Edit user dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Editing ${editing.email}. Leave password blank to keep unchanged.`
                : 'Enter first name, last name, and role. Email and password are auto-generated.'}
            </DialogDescription>
          </DialogHeader>

          {createdInfo && !editing ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-accent flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> User created successfully!
                </p>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {createdInfo.name}</div>
                  <div><span className="text-muted-foreground">Email:</span> <code className="font-mono text-foreground">{createdInfo.email}</code></div>
                  <div><span className="text-muted-foreground">Password:</span> <code className="font-mono text-foreground">{createdInfo.password}</code></div>
                </div>
                <p className="text-xs text-muted-foreground">The user can change their password after logging in.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setCreatedInfo(null) }}>Close</Button>
                <Button onClick={() => { setCreatedInfo(null); openCreate() }}>Add another</Button>
              </div>
            </div>
          ) : editing ? (
            <form onSubmit={form.handleSubmit(async (values: UserValues) => {
              try {
                const payload: any = {
                  name: values.name, email: values.email, role: values.role,
                  phone: values.phone || undefined, status: values.status,
                }
                if (values.role === 'LEARNER' && values.grade) payload.grade = Number(values.grade)
                if (values.password) payload.password = values.password
                if (values.role === 'SUPER_USER') payload.schoolId = null
                else payload.schoolId = values.schoolId && values.schoolId !== 'none' ? values.schoolId : null
                await api.patch(`/api/users/${editing.id}`, payload)
                toast.success('User updated')
                setDialogOpen(false)
                load()
              } catch (e: any) { toast.error(e?.message || 'Save failed') }
            })} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_USER">Super User</SelectItem>
                      <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="LEARNER">Learner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="school">School</Label>
                  <Select
                    value={form.watch('schoolId') ?? 'none'}
                    onValueChange={(v) => form.setValue('schoolId', v)}
                    disabled={form.watch('role') === 'SUPER_USER'}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {form.watch('role') === 'SUPER_USER' ? 'Platform-wide (auto)' : 'No school'}
                      </SelectItem>
                      {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="grade">Grade (learner only)</Label>
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
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" {...form.register('phone')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name *</Label>
                  <Input
                    id="firstName" value={createFirstName}
                    onChange={(e) => setCreateFirstName(e.target.value)}
                    placeholder="Thabo"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name *</Label>
                  <Input
                    id="lastName" value={createLastName}
                    onChange={(e) => setCreateLastName(e.target.value)}
                    placeholder="Mumba"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="createRole">Role *</Label>
                  <Select value={createRole} onValueChange={setCreateRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_USER">Super User</SelectItem>
                      <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="LEARNER">Learner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="createSchool">School {createRole !== 'SUPER_USER' && '*'}</Label>
                  <Select
                    value={createSchoolId || 'none'}
                    onValueChange={setCreateSchoolId}
                    disabled={createRole === 'SUPER_USER'}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {createRole === 'SUPER_USER' ? 'Platform-wide (auto)' : 'No school'}
                      </SelectItem>
                      {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createRole === 'LEARNER' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="createGrade">Grade *</Label>
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
                    <Label htmlFor="createPhone">Phone (optional)</Label>
                    <Input
                      id="createPhone" value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      placeholder="+260..."
                    />
                  </div>
                </div>
              )}
              {createRole !== 'LEARNER' && (
                <div className="space-y-1.5">
                  <Label htmlFor="createPhone2">Phone (optional)</Label>
                  <Input
                    id="createPhone2" value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="+260..."
                  />
                </div>
              )}
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p>Email will be auto-generated: <code className="font-mono text-foreground">
                  {createFirstName && createLastName
                    ? `${createFirstName.toLowerCase()}.${createLastName.toLowerCase().replace(/\s+/g, '')}@eduquest.zm`
                    : 'firstname.lastname@eduquest.zm'}
                </code></p>
                <p>Default password: <code className="font-mono text-foreground">eduquest123</code> (user can change it after logging in)</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={!createFirstName.trim() || !createLastName.trim() || createSubmitting || (createRole !== 'SUPER_USER' && !createSchoolId)}
                  onClick={submitCreate}
                >
                  {createSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create user
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
              <UploadCloud className="h-5 w-5 text-primary" /> Bulk Import Users
            </DialogTitle>
            <DialogDescription>
              Paste a CSV with a header row. Columns: <code>name, email, password, role, grade, phone, class_code</code>.
              Required: <code>name</code>, <code>email</code>. Password defaults to <code>eduquest123</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-school">Target School</Label>
              <Select value={bulkSchool} onValueChange={setBulkSchool}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Platform-wide (Super User only)</SelectItem>
                  {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
        title="Delete user?"
        description="This will permanently delete the user and all related data. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
