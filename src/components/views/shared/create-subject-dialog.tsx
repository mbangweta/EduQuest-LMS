'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface CreatedSubject {
  id: string
  name: string
  code: string
  description: string | null
  color: string
}

// Create Subject dialog — used by super user, school admin, and teacher views.
// On success, calls onCreated(subject) so the parent can refresh its list.
export function CreateSubjectDialog({ onCreated }: { onCreated: (s: CreatedSubject) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#2563eb')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!name || !code) {
      toast.error('Name and code are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, code: code.toUpperCase(),
          description: description || null, color,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create subject')
        return
      }
      toast.success(`Subject "${data.subject.name}" created`)
      onCreated(data.subject)
      setName(''); setCode(''); setDescription(''); setColor('#2563eb')
      setOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create subject')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3 w-3" /> New Subject
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(''); setCode(''); setDescription(''); setColor('#2563eb') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Subject</DialogTitle>
            <DialogDescription>
              Add a new subject to the platform. Subjects are shared across all schools (Zambian curriculum).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="subj-name">Subject name *</Label>
              <Input id="subj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Agricultural Science" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subj-code">Subject code *</Label>
              <Input
                id="subj-code" value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. AGSCI" maxLength={8}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">Short uppercase code (max 8 chars). Must be unique.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subj-desc">Description (optional)</Label>
              <Input id="subj-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Grades 8–9 Agricultural Science" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subj-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="subj-color" type="color" value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!name || !code || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
