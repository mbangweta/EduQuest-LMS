'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BookOpen, ChevronRight, FileText, FileQuestion, Plus, Loader2, Copy } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { EmptyState } from '@/components/views/shared/empty-state'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export function LearnerClassesView() {
  const { navigate } = useRouter()
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [joinOpen, setJoinOpen] = useState(false)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => setClasses(r.classes))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function joinClass() {
    if (!code) return
    setJoining(true)
    try {
      await api.post('/api/classes/join', { classCode: code })
      toast.success('Joined class!')
      setCode('')
      setJoinOpen(false)
      const r = await api.get<{ classes: any[] }>('/api/classes')
      setClasses(r.classes)
    } catch (e: any) { toast.error(e?.message || 'Failed to join') }
    finally { setJoining(false) }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Classes</h1>
          <p className="text-sm text-muted-foreground">Classes you are enrolled in.</p>
        </div>
        <Button onClick={() => setJoinOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Join by Code
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No classes yet"
          description="Ask your teacher for the class code, or join one now."
          action={<Button onClick={() => setJoinOpen(true)}><Plus className="mr-2 h-4 w-4" /> Join by Code</Button>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('learner.class-detail', { classId: c.id })}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.subject?.name}</div>
                  </div>
                  <Badge variant="secondary">Grade {c.grade}</Badge>
                </div>
                {c.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>}
                <div className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
                  <UserAvatar name={c.teacher?.name} color={c.teacher?.avatarColor} size="sm" />
                  <span>{c.teacher?.name}</span>
                  <span className="ml-auto flex items-center gap-1"><ChevronRight className="h-4 w-4" /></span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a Class</DialogTitle>
            <DialogDescription>Enter the class code from your teacher.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="G7PM-2025" className="font-mono uppercase" />
            <p className="text-xs text-muted-foreground">Tip: ask your teacher for the 7-character code.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button onClick={joinClass} disabled={joining || !code}>
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
