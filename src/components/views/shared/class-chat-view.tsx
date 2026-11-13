'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Send, Plus, ArrowLeft, Pin, Hash } from 'lucide-react'
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
import { UserAvatar } from '@/components/views/shared/user-avatar'
import { EmptyState } from '@/components/views/shared/empty-state'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export function ClassChatView({ classId }: { classId?: string }) {
  const { user } = useCurrentUser()
  const qc = useQueryClient()
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [convTitle, setConvTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversations
  const { data: convData, isLoading: convLoading } = useQuery<any>({
    queryKey: ['class-conversations', classId],
    queryFn: () => api.get(`/api/classes/${classId}/conversations`),
    enabled: !!classId,
    staleTime: 15_000,
  })

  // Fetch messages for active conversation
  const { data: msgData, isLoading: msgLoading } = useQuery<any>({
    queryKey: ['class-messages', classId, activeConversation],
    queryFn: () => api.get(`/api/classes/${classId}/conversations/${activeConversation}/messages`),
    enabled: !!classId && !!activeConversation,
    staleTime: 5_000,
    refetchInterval: 10_000,
  })

  const conversations = convData?.conversations || []
  const messages = msgData?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function createConversation() {
    if (!convTitle.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/api/classes/${classId}/conversations`, { title: convTitle })
      toast.success('Conversation started')
      setConvTitle('')
      setNewConvOpen(false)
      qc.invalidateQueries({ queryKey: ['class-conversations', classId] })
    } catch (e: any) {
      toast.error(e?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendMessage() {
    if (!message.trim() || !activeConversation) return
    setSubmitting(true)
    try {
      await api.post(`/api/classes/${classId}/conversations/${activeConversation}/messages`, { message })
      setMessage('')
      qc.invalidateQueries({ queryKey: ['class-messages', classId, activeConversation] })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send')
    } finally {
      setSubmitting(false)
    }
  }

  // If a conversation is active, show the chat view
  if (activeConversation) {
    const conv = conversations.find((c: any) => c.id === activeConversation)
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b pb-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveConversation(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{conv?.title || 'Conversation'}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scroll-thin space-y-3 py-4">
          {msgLoading ? (
            <div className="flex items-center justify-center py-8">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No messages yet" description="Be the first to start the conversation." />
          ) : (
            <AnimatePresence>
              {messages.map((m: any) => {
                const isOwn = m.author_id === user?.id
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <UserAvatar name={m.author?.name || '?'} color={m.author?.avatar_color} size="sm" />
                    <div className={`max-w-[70%] ${isOwn ? 'items-end' : ''}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-medium">{isOwn ? 'You' : m.author?.name}</span>
                        <Badge variant="outline" className="text-[10px]">{m.author?.role?.replace('_', ' ')}</Badge>
                      </div>
                      <div className={`rounded-lg px-3 py-2 text-sm ${
                        isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {m.message}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="border-t pt-3 flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          <Button onClick={sendMessage} disabled={!message.trim() || submitting} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Default: show conversation list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" /> Class Discussions
          </h2>
          <p className="text-sm text-muted-foreground">Ask questions, seek clarification, or discuss with classmates.</p>
        </div>
        <Button size="sm" onClick={() => setNewConvOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Topic
        </Button>
      </div>

      {convLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-8 w-8" />}
          title="No discussions yet"
          description="Start a new topic to begin a class discussion."
          action={<Button onClick={() => setNewConvOpen(true)}><Plus className="mr-1 h-4 w-4" /> Start a Discussion</Button>}
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {conversations.map((c: any) => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <button onClick={() => setActiveConversation(c.id)} className="w-full text-left">
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      {c.pinned && <Pin className="h-4 w-4 text-accent shrink-0" />}
                      <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Started by {c.created_by_user?.name}
                          {' · '}
                          {c._count?.length || c._count || 0} messages
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* New conversation dialog */}
      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a New Discussion</DialogTitle>
            <DialogDescription>Start a public conversation for this class. All class members can see and reply.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Topic title</Label>
              <Input
                value={convTitle}
                onChange={(e) => setConvTitle(e.target.value)}
                placeholder="e.g. Question about fractions homework"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewConvOpen(false)}>Cancel</Button>
            <Button onClick={createConversation} disabled={!convTitle.trim() || submitting}>
              {submitting ? 'Creating...' : 'Start Discussion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
