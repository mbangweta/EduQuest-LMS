'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Change password dialog — current user changes their own password.
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = current && next.length >= 6 && next === confirm && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to change password')
        return
      }
      toast.success('Password changed successfully')
      setCurrent(''); setNext(''); setConfirm('')
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Change Password
          </DialogTitle>
          <DialogDescription>
            Choose a new password. It must be at least 6 characters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pw">Current password</Label>
            <div className="relative">
              <Input
                id="cur-pw" type={showCur ? 'text' : 'password'} value={current}
                onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password"
                className="pr-9"
              />
              <button type="button" onClick={() => setShowCur((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative">
              <Input
                id="new-pw" type={showNew ? 'text' : 'password'} value={next}
                onChange={(e) => setNext(e.target.value)} autoComplete="new-password"
                className="pr-9"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {next && next.length < 6 && (
              <p className="text-xs text-destructive">Must be at least 6 characters</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conf-pw">Confirm new password</Label>
            <div className="relative">
              <Input
                id="conf-pw" type={showConf ? 'text' : 'password'} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
                className="pr-9"
              />
              <button type="button" onClick={() => setShowConf((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirm && confirm !== next && (
              <p className="text-xs text-destructive">Passwords don't match</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
