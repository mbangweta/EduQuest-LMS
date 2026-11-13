'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Reset password dialog — super user or school admin resets another user's password.
export function ResetPasswordDialog({
  open, onOpenChange, userId, userName,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string; userName: string }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = newPassword.length >= 6 && newPassword === confirm && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to reset password')
        return
      }
      toast.success(`Password reset for ${userName}`)
      setNewPassword(''); setConfirm('')
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Reset Password for {userName}
          </DialogTitle>
          <DialogDescription>
            Set a new password for this user. They'll need to use it next time they sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reset-pw">New password</Label>
            <Input
              id="reset-pw" type="text" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-destructive">Must be at least 6 characters</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-conf">Confirm new password</Label>
            <Input
              id="reset-conf" type="text" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && confirm !== newPassword && (
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
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
