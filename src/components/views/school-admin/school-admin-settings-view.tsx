'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Loader2, Building2, Mail, Phone, MapPin, Globe, ImageIcon, Quote } from 'lucide-react'

import { api } from '@/lib/api-client'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function SchoolAdminSettingsView() {
  const { user } = useCurrentUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [school, setSchool] = useState<any | null>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [motto, setMotto] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    if (!user?.schoolId) return
    setLoading(true)
    api.get<{ school: any }>(`/api/schools/${user.schoolId}`)
      .then((r) => {
        setSchool(r.school)
        setName(r.school.name ?? '')
        setCode(r.school.code ?? '')
        setAddress(r.school.address ?? '')
        setPhone(r.school.phone ?? '')
        setEmail(r.school.email ?? '')
        setMotto(r.school.motto ?? '')
        setWebsite(r.school.website ?? '')
        setLogoUrl(r.school.logo_url ?? '')
      })
      .catch((e) => toast.error(e?.message || 'Failed to load school'))
      .finally(() => setLoading(false))
  }, [user?.schoolId])

  async function save() {
    if (!user?.schoolId) {
      toast.error('No school assigned to your account')
      return
    }
    setSaving(true)
    try {
      await api.patch(`/api/schools/${user.schoolId}`, {
        name,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        motto: motto || undefined,
        website: website || undefined,
        logo_url: logoUrl || undefined,
      })
      toast.success('Settings saved')
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!user?.schoolId) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl">
        <p className="text-sm text-muted-foreground">Your account is not associated with a school.</p>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" /> School Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Update the details for your school. The code is read-only — contact a Super User to change it.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{school?.name}</span>
              <Badge variant="outline" className="font-mono">{school?.code}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">School Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code (read-only)</Label>
              <Input id="code" value={code} disabled className="font-mono bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Address
              </Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motto" className="flex items-center gap-1">
                <Quote className="h-3 w-3" /> School Motto
              </Label>
              <Input id="motto" value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="e.g. Towards A Brighter Future" />
              <p className="text-xs text-muted-foreground">Appears at the top of every report card.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="website" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Website
                </Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.yourschool.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logoUrl" className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Logo URL
                </Label>
                <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These details appear on every learner&apos;s report card — each school has its own motto, address, phone, email, and website.
            </p>
            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
