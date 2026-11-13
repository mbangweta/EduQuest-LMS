'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const KEY = 'eduquest:settings'

export function AdminSettingsView() {
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    displayName: 'EduQuest LMS',
    supportEmail: 'support@eduquest.zm',
    academicYear: '2025',
    language: 'English',
    timezone: 'Africa/Lusaka',
    announcement: 'Welcome to EduQuest LMS — Learning for Zambia, Grades 5–12.',
  })

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null
    if (raw) {
      try { setSettings(JSON.parse(raw)) } catch {}
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
      await new Promise((r) => setTimeout(r, 400))
      toast.success('Settings saved')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-sm text-muted-foreground">General platform configuration. (Stored locally in this build.)</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={settings.displayName} onChange={(e) => setSettings({ ...settings, displayName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support">Support Email</Label>
            <Input id="support" type="email" value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year">Academic Year</Label>
              <Input id="year" value={settings.academicYear} onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lang">Default Language</Label>
              <Select value={settings.language} onValueChange={(v) => setSettings({ ...settings, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Cinyanja">Cinyanja</SelectItem>
                  <SelectItem value="Bemba">Bemba</SelectItem>
                  <SelectItem value="Tonga">Tonga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz">Timezone</Label>
            <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Africa/Lusaka">Africa/Lusaka (CAT)</SelectItem>
                <SelectItem value="Africa/Harare">Africa/Harare</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann">Announcement Banner</Label>
            <Textarea id="ann" rows={2} value={settings.announcement} onChange={(e) => setSettings({ ...settings, announcement: e.target.value })} />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
