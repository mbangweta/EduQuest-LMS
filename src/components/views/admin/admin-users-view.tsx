'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, UserPlus, Loader2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { EmptyState } from '@/components/views/shared/empty-state'

const userSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['ADMIN', 'TEACHER', 'LEARNER']),
  grade: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(6, 'Min 6 chars'),
  status: z.enum(['ACTIVE', 'DISABLED']),
})
type UserValues = z.infer<typeof userSchema>

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', TEACHER: 'Teacher', LEARNER: 'Learner' }

export function AdminUsersView() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>('ALL')
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)

  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', role: 'LEARNER', password: '', status: 'ACTIVE' },
  })

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (role !== 'ALL') params.set('role', role)
      if (query) params.set('q', query)
      const { users } = await api.get<{ users: any[] }>(`/api/users${params.toString() ? `?${params}` : ''}`)
      setUsers(users)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [role])

  const filtered = useMemo(() => {
    if (!query) return users
    const q = query.toLowerCase()
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [users, query])

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', email: '', role: 'LEARNER', password: '', status: 'ACTIVE', grade: '', phone: '' })
    setDialogOpen(true)
  }
  function openEdit(u: any) {
    setEditing(u)
    form.reset({
      name: u.name,
      email: u.email,
      role: u.role,
      password: '',
      status: u.status,
      grade: u.grade ? String(u.grade) : '',
      phone: u.phone ?? '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(values: UserValues) {
    try {
      const payload: any = {
        name: values.name,
        email: values.email,
        role: values.role,
        phone: values.phone || undefined,
        status: values.status,
      }
      if (values.role === 'LEARNER' && values.grade) payload.grade = Number(values.grade)
      if (values.password) payload.password = values.password
      if (editing) {
        await api.patch(`/api/users/${editing.id}`, payload)
        toast.success('User updated')
      } else {
        if (!values.password) {
          form.setError('password', { message: 'Required for new user' })
          return
        }
        await api.post('/api/users', payload)
        toast.success('User created')
      }
      setDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
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

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage administrators, teachers and learners.</p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
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
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="TEACHER">Teacher</SelectItem>
              <SelectItem value="LEARNER">Learner</SelectItem>
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
                        <Badge variant={u.role === 'ADMIN' ? 'destructive' : u.role === 'TEACHER' ? 'default' : 'secondary'}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editing ? `Editing ${editing.email}. Leave password blank to keep unchanged.` : 'Create a new account.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="LEARNER">Learner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password {editing && '(blank = unchanged)'}</Label>
                <Input id="password" type="password" {...form.register('password')} />
                {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
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
                {editing ? 'Save changes' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
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
