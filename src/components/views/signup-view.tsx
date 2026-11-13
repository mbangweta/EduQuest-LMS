'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  GraduationCap, Loader2, Lock, Mail, Phone, MapPin, Building2, User,
  Upload, ArrowLeft, School, UserCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api-client'

const MAX_LOGO_BYTES = 100 * 1024 // 100 KB

const signupSchema = z.object({
  institutionType: z.enum(['SCHOOL', 'PERSONAL']),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  primaryPhone: z.string().min(6, 'Primary contact number is required'),
  secondaryPhone: z.string().optional(),
  address: z.string().optional(),
  motto: z.string().optional(),
})

type SignupValues = z.infer<typeof signupSchema>

export function SignupView({ onBack }: { onBack?: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string>('')
  const [logoError, setLogoError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      institutionType: 'SCHOOL',
      name: '', email: '', password: '',
      primaryPhone: '', secondaryPhone: '', address: '', motto: '',
    },
  })

  const institutionType = form.watch('institutionType')

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError('')
    const file = e.target.files?.[0]
    if (!file) {
      setLogoDataUrl('')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Logo is ${Math.round(file.size / 1024)} KB — maximum is 100 KB.`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      // Double-check size of the data URL
      const base64Part = result.split(',')[1] || ''
      const approxBytes = Math.ceil(base64Part.length * 0.75)
      if (approxBytes > MAX_LOGO_BYTES) {
        setLogoError(`Logo is ${Math.round(approxBytes / 1024)} KB when encoded — maximum is 100 KB. Try a smaller or more compressed image.`)
        return
      }
      setLogoDataUrl(result)
    }
    reader.onerror = () => setLogoError('Failed to read the file. Please try another image.')
    reader.readAsDataURL(file)
  }

  async function onSubmit(values: SignupValues) {
    if (logoError) {
      toast.error(logoError)
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        logoDataUrl: logoDataUrl || undefined,
      }
      await api.post('/api/auth/signup', payload)
      toast.success('Account created — please sign in with your new credentials.')
      // Send the user back to the login screen
      onBack?.()
    } catch (e: any) {
      toast.error(e?.message || 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-primary/95 to-primary">
      {/* Left brand panel */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 text-primary-foreground">
        <div className="max-w-xl mx-auto lg:mx-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <GraduationCap className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">EduQuest LMS</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Create your account.
          </h1>
          <p className="text-lg text-primary-foreground/80 mb-6">
            Register as a school or as an individual teacher. Schools get full
            access to classes, mark schedules, and report cards. Individual
            teachers get a lightweight account for up to 10 learners and 3 classes.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Grades 4–7</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Zambian curriculum</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Auto-calculated term totals</span>
          </div>
        </div>
      </div>

      {/* Right form card */}
      <div className="lg:w-[560px] p-4 sm:p-8 flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Create account</CardTitle>
              <p className="text-sm text-muted-foreground">
                Fill in the details below. You&apos;ll sign in after your account is created.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Account type toggle */}
                <div className="space-y-2">
                  <Label>Account type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => form.setValue('institutionType', 'SCHOOL')}
                      className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${
                        institutionType === 'SCHOOL'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <School className="h-5 w-5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">School</div>
                        <div className="text-xs text-muted-foreground">Full access</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => form.setValue('institutionType', 'PERSONAL')}
                      className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${
                        institutionType === 'PERSONAL'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <UserCircle className="h-5 w-5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">Individual Teacher</div>
                        <div className="text-xs text-muted-foreground">Max 10 learners, 3 classes</div>
                      </div>
                    </button>
                  </div>
                  {form.formState.errors.institutionType && (
                    <p className="text-xs text-destructive">{form.formState.errors.institutionType.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    {institutionType === 'SCHOOL' ? 'School name' : 'Your name'}
                  </Label>
                  <div className="relative">
                    {institutionType === 'SCHOOL'
                      ? <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      : <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                    <Input
                      id="name"
                      placeholder={institutionType === 'SCHOOL' ? 'e.g. Chudleigh House Primary' : 'e.g. Mr. Bwalya'}
                      className="pl-9"
                      {...form.register('name')}
                    />
                  </div>
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@school.edu.zm"
                      className="pl-9"
                      {...form.register('email')}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      className="pl-9"
                      {...form.register('password')}
                    />
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="primaryPhone">Primary phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="primaryPhone"
                        type="tel"
                        placeholder="+260 97 123 4567"
                        className="pl-9"
                        {...form.register('primaryPhone')}
                      />
                    </div>
                    {form.formState.errors.primaryPhone && (
                      <p className="text-xs text-destructive">{form.formState.errors.primaryPhone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryPhone">Secondary phone <span className="text-muted-foreground">(optional)</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="secondaryPhone"
                        type="tel"
                        placeholder="+260 95 987 6543"
                        className="pl-9"
                        {...form.register('secondaryPhone')}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Physical address <span className="text-muted-foreground">(optional)</span></Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="address"
                      rows={2}
                      placeholder="Plot 12, Education Road, Lusaka, Zambia"
                      className="pl-9"
                      {...form.register('address')}
                    />
                  </div>
                </div>

                {institutionType === 'SCHOOL' && (
                  <div className="space-y-2">
                    <Label htmlFor="motto">School motto <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="motto"
                      placeholder="e.g. Knowledge is power"
                      {...form.register('motto')}
                    />
                  </div>
                )}

                {/* Logo upload */}
                <div className="space-y-2">
                  <Label htmlFor="logo">
                    {institutionType === 'SCHOOL' ? 'School logo' : 'Profile logo'}{' '}
                    <span className="text-muted-foreground">(optional, max 100 KB)</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-3.5 w-3.5" /> Choose file
                    </Button>
                    {logoDataUrl && (
                      <img
                        src={logoDataUrl}
                        alt="Logo preview"
                        className="h-12 w-12 object-contain border rounded"
                      />
                    )}
                    {logoDataUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogoDataUrl('')
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  {logoError && (
                    <p className="text-xs text-destructive">{logoError}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? 'Creating account…' : 'Create account'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to sign in
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            EduQuest LMS · © {new Date().getFullYear()} · For Zambian classrooms
          </p>
        </div>
      </div>
    </div>
  )
}
