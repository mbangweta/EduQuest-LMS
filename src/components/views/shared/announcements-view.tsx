'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { Megaphone, Plus, Send, Lock, Globe2, ChevronDown, ChevronUp, MessageSquare, UserCircle } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { EmptyState } from '@/components/views/shared/empty-state'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: 'Everyone',
  SCHOOL_ADMIN: 'School Admins',
  TEACHER: 'Teachers',
  LEARNER: 'Learners',
  ADMIN_AND_TEACHER: 'School Admins & Teachers',
  TEACHER_AND_LEARNER: 'Teachers & Learners',
}

export function AnnouncementsView() {
  const { user } = useCurrentUser()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyPrivate, setReplyPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Create form
  const [form, setForm] = useState({ title: '', message: '', audience: '' })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['announcements'],
    queryFn: () => api.get('/api/announcements'),
    staleTime: 30_000,
  })

  const announcements = data?.announcements || []

  // Get available audiences based on role
  const availableAudiences = (() => {
    if (!user) return []
    if (user.role === 'SUPER_USER') return ['ALL', 'SCHOOL_ADMIN', 'TEACHER', 'LEARNER', 'ADMIN_AND_TEACHER', 'TEACHER_AND_LEARNER']
    if (user.role === 'SCHOOL_ADMIN') return ['TEACHER', 'LEARNER', 'ADMIN_AND_TEACHER', 'TEACHER_AND_LEARNER']
    if (user.role === 'TEACHER') return ['LEARNER']
    return []
  })()

  const canCreate = user && ['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)

  // Set default audience when user loads
  useEffect(() => {
    if (user && !form.audience && availableAudiences.length > 0) {
      setForm(f => ({ ...f, audience: availableAudiences[0] }))
    }
  }, [user, availableAudiences])

  async function createAnnouncement() {
    if (!form.title || !form.message) { toast.error('Title and message required'); return }
    setSubmitting(true)
    try {
      await api.post('/api/announcements', form)
      toast.success('Announcement created')
      setForm({ title: '', message: '', audience: availableAudiences[0] || 'ALL' })
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['announcements'] })
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendReply(announcementId: string) {
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/api/announcements/${announcementId}/replies`, {
        message: replyText,
        isPrivate: replyPrivate,
      })
      toast.success(replyPrivate ? 'Private reply sent' : 'Reply sent')
      setReplyText('')
      setReplyPrivate(false)
      // Invalidate the replies query
      qc.invalidateQueries({ queryKey: ['announcements', announcementId, 'replies'] })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            {canCreate ? 'Create announcements and manage replies.' : 'View announcements and reply.'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Announcement
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="No announcements" description="Check back later for updates." />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {announcements.map((a: any) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                expanded={expandedId === a.id}
                onToggle={() => toggleExpand(a.id)}
                user={user}
                replyText={replyText}
                setReplyText={setReplyText}
                replyPrivate={replyPrivate}
                setReplyPrivate={setReplyPrivate}
                onSendReply={() => sendReply(a.id)}
                submitting={submitting}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>Create an announcement for your selected audience.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Term 3 Exam Schedule" />
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Write your announcement..." />
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableAudiences.map((a) => (
                    <SelectItem key={a} value={a}>{AUDIENCE_LABELS[a] || a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createAnnouncement} disabled={!form.title || !form.message || submitting}>
              {submitting ? 'Sending...' : 'Send Announcement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AnnouncementCard(props: any) {
  const { announcement: a, expanded, onToggle, user, replyText, setReplyText, replyPrivate, setReplyPrivate, onSendReply, submitting } = props
  const [replies, setReplies] = useState<any[]>([])

  useEffect(() => {
    if (expanded) {
      api.get(`/api/announcements/${a.id}/replies`).then((r: any) => setReplies(r.replies || [])).catch(() => {})
    }
  }, [expanded, a.id])

  const isAuthor = a.author_id === user?.id

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <UserAvatar name={a.author?.name || 'Unknown'} color={a.author?.avatar_color} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{a.author?.name}</span>
                <Badge variant="secondary" className="text-xs">{a.author?.role?.replace('_', ' ')}</Badge>
                <Badge variant="outline" className="text-xs">
                  {a.school_id ? <Globe2 className="mr-1 h-3 w-3" /> : null}
                  {AUDIENCE_LABELS[a.audience] || a.audience}
                </Badge>
              </div>
              <h3 className="font-bold text-base mt-1">{a.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.message}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : ''}</span>
                <button onClick={onToggle} className="flex items-center gap-1 hover:text-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'Reply'}
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>

              {/* Replies (expanded) */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2 pl-4 border-l-2 border-border">
                      {replies.map((r: any) => (
                        <div key={r.id} className="flex items-start gap-2">
                          <UserAvatar name={r.author?.name} color={r.author?.avatar_color} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-xs">{r.author?.name}</span>
                              <Badge variant="outline" className="text-[10px]">{r.author?.role?.replace('_', ' ')}</Badge>
                              {r.is_private && (
                                <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                                  <Lock className="mr-1 h-2.5 w-2.5" /> Private
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm mt-0.5">{r.message}</p>
                            <span className="text-[10px] text-muted-foreground">{r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ''}</span>
                          </div>
                        </div>
                      ))}

                      {/* Reply input */}
                      <div className="pt-2">
                        <div className="flex gap-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            rows={2}
                            className="flex-1 text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={replyPrivate}
                              onChange={(e) => setReplyPrivate(e.target.checked)}
                              className="rounded"
                            />
                            <Lock className="h-3 w-3" /> Private reply (only author can see)
                          </label>
                          <Button
                            size="sm"
                            onClick={onSendReply}
                            disabled={!replyText.trim() || submitting}
                          >
                            <Send className="mr-1 h-3 w-3" /> Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
