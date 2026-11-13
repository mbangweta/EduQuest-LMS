'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { GraduationCap, ChevronDown, ChevronUp, Loader2, Lock, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { supabaseBrowser } from '@/lib/supabase-browser'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const DEMO_ACCOUNTS = [
  { label: 'School Admin · Headmaster', email: 'headmaster@eduquest.zm' },
  { label: 'Teacher · Mrs. Siya', email: 'mrs.siya@eduquest.zm' },
  { label: 'Teacher · Mr. Chisango', email: 'mr.chisango@eduquest.zm' },
  { label: 'Learner · Grade 7 (Thabo)', email: 'thabo@eduquest.zm' },
  { label: 'Learner · Grade 7 (Chipo)', email: 'chipo@eduquest.zm' },
  { label: 'Learner · Grade 6 (Lubosi)', email: 'lubosi@eduquest.zm' },
  { label: 'Learner · Grade 8 (Kabwe)', email: 'kabwe@eduquest.zm' },
  { label: 'Learner · Grade 5 (Natasha)', email: 'natasha@eduquest.zm' },
  { label: 'Learner · Grade 9 (Mutale)', email: 'mutale@eduquest.zm' },
]

const DEMO_PASSWORD = 'eduquest123'

export function LoginView({ embedded = false }: { embedded?: boolean }) {
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(true)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setSubmitting(true)
    try {
      const sb = supabaseBrowser()
      const { data, error } = await sb.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      if (error || !data.user) {
        toast.error(error?.message || 'Invalid email or password')
        return
      }
      toast.success('Welcome back to EduQuest')
      // Force reload to rehydrate the role-aware session via /api/auth/me
      window.location.reload()
    } catch (e: any) {
      toast.error(e?.message || 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  function applyAccount(email: string) {
    form.setValue('email', email)
    form.setValue('password', DEMO_PASSWORD)
    form.clearErrors()
  }

  return (
    <div className={embedded
      ? "min-h-screen flex items-center justify-center bg-background p-4"
      : "min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-primary/95 to-primary"}
    >
      {/* Left brand panel — hidden when embedded */}
      {!embedded && (
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 text-primary-foreground">
        <div className="max-w-xl mx-auto lg:mx-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <GraduationCap className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">EduQuest LMS</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Learning for Zambia.
          </h1>
          <p className="text-lg text-primary-foreground/80 mb-6">
            A modern Learning Management System for Zambian primary and secondary schools, aligned with the Zambian curriculum and ECZ examination standards.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Grades 4–7</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">ECZ Standards</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm">AI-Assisted Marking</span>
          </div>
        </div>
      </div>
      )}

      {/* Right login card */}
      <div className={embedded
        ? "w-full max-w-md"
        : "lg:w-[480px] p-4 sm:p-8 flex items-center justify-center bg-background"
      }>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center" style={embedded ? { display: 'flex' } : undefined}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">EduQuest LMS</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <p className="text-sm text-muted-foreground">Use your EduQuest account or a demo account below.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@eduquest.zm"
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
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pl-9"
                      {...form.register('password')}
                    />
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    <span>Demo accounts (password: {DEMO_PASSWORD})</span>
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-md border bg-muted/30 p-2 max-h-72 overflow-y-auto scroll-thin">
                    {DEMO_ACCOUNTS.map((a) => (
                      <button
                        key={a.email}
                        type="button"
                        onClick={() => applyAccount(a.email)}
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-background transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{a.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                        </div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                          Use
                        </span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
