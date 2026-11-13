'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Users, BookOpen, Brain, Sparkles, Trophy,
  ArrowRight, Menu, X, CheckCircle2, BarChart3, ShieldCheck,
  Clock, Bell, FileText, Layers, Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { LoginView } from '@/components/views/login-view'

interface PublicStats {
  counts: {
    users: number
    teachers: number
    learners: number
    classes: number
    subjects: number
    lessons: number
    quizzes: number
    attempts: number
    publishedLessons: number
    publishedQuizzes: number
  }
  subjects: Array<{
    id: string
    name: string
    code: string
    description: string | null
    color: string | null
    lessonCount: number
    quizCount: number
  }>
  recentLessons: Array<{
    id: string
    title: string
    grade: number
    topic: string
    subject: { name: string; color: string | null }
    teacher: { name: string }
  }>
}

// Animated number counter — counts up from 0 to value when in view
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const duration = 1500
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span>{display.toLocaleString()}{suffix}</span>
}

const FEATURES = [
  {
    icon: Brain,
    title: 'Auto Quiz Generation',
    desc: 'Generate ECZ-aligned quizzes in seconds. Just enter the topic, grade, and question types — the system does the rest.',
    color: 'text-primary bg-primary/10',
  },
  {
    icon: CheckCircle2,
    title: 'Instant Auto-Marking',
    desc: 'Multiple choice, true/false, fill-in-blank, numerical, matching — all marked deterministically on submission.',
    color: 'text-accent bg-accent/10',
  },
  {
    icon: BookOpen,
    title: 'Rich Lesson Library',
    desc: 'Create lessons manually or auto-generate them. Markdown notes, activities, examples, homework, and video links.',
    color: 'text-chart-3 bg-chart-3/10',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    desc: 'Class averages, pass rates, score distributions, per-learner progress over time. Exportable to CSV.',
    color: 'text-chart-4 bg-chart-4/10',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Role-Based',
    desc: 'Admin, Teacher, Learner roles with strict permissions. Learners never see answer keys before submission.',
    color: 'text-chart-5 bg-chart-5/10',
  },
  {
    icon: Bell,
    title: 'In-App Notifications',
    desc: 'New quizzes, lessons, deadlines, submissions, results — all surfaced in the bell with unread counts.',
    color: 'text-primary bg-primary/10',
  },
]

const STEPS = [
  {
    n: 1,
    icon: Users,
    title: 'Admin sets up the platform',
    desc: 'Create teachers, learners, classes, and subjects. Monitor everything from one dashboard.',
  },
  {
    n: 2,
    icon: Sparkles,
    title: 'Teachers build lessons & quizzes',
    desc: 'Auto-generate curriculum-aligned content in seconds. Edit, save as draft, publish when ready.',
  },
  {
    n: 3,
    icon: Trophy,
    title: 'Learners study & take quizzes',
    desc: 'Access lessons, take quizzes, get auto-marked instantly, see scores and explanations immediately.',
  },
]

const TESTIMONIALS = [
  {
    quote: 'My Grade 7 class loves the Fractions Quiz. They get their scores back instantly and can see why each answer is right or wrong.',
    name: 'Mrs. Siya Mwansa',
    role: 'Mathematics Teacher · Lusaka',
  },
  {
    quote: 'Generating a Science quiz takes me 30 seconds now instead of 30 minutes. The questions are perfectly aligned to the Zambian curriculum.',
    name: 'Mr. Chisango Banda',
    role: 'Integrated Science Teacher · Copperbelt',
  },
  {
    quote: 'I can see all my quiz results in one place. I know which topics my learners are struggling with and which need more practice.',
    name: 'Bwalya Phiri',
    role: 'School Administrator · Ndola',
  },
]

export function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Single API call with light polling (every 60s) — no realtime WebSockets on the
  // public landing page. Realtime is only used after login (dashboards).
  const { data: stats, isLoading } = useQuery<PublicStats>({
    queryKey: ['public-stats'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/public')
      if (!res.ok) throw new Error('Failed to load stats')
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* === NAVBAR === */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="font-bold text-lg tracking-tight">
              EduQuest <span className="text-primary">LMS</span>
            </div>
          </motion.div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#subjects" className="text-muted-foreground hover:text-foreground transition-colors">Subjects</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Voices</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setShowLogin(true)}
            >
              Sign in
            </Button>
            <Button size="sm" onClick={() => setShowLogin(true)}>
              Get Started
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-border/60 bg-background"
            >
              <div className="px-4 py-3 flex flex-col gap-1">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded hover:bg-muted text-sm">Features</a>
                <a href="#subjects" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded hover:bg-muted text-sm">Subjects</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded hover:bg-muted text-sm">How it works</a>
                <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded hover:bg-muted text-sm">Voices</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* === HERO === */}
      <section className="relative overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-chart-3/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="secondary" className="mb-5">
                ECZ-Aligned · Zambian Curriculum
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-5">
                Learning for Zambia.<br />
                <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  Built for every learner.
                </span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl">
A modern Learning Management System built for Zambian schools. Teachers can create lessons, generate assessments, assign quizzes, and track learner performance, while learners access learning resources, complete assessments, and receive instant auto-marked results. Fully aligned with the Zambian curriculum and ECZ examination standards, the platform makes teaching, learning, assessment, and exam preparation smarter and more effective.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => setShowLogin(true)}>
                  Start learning
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                }}>
                  <Play className="mr-2 h-4 w-4" />
                  See how it works
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Grades 4–7</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Zambian curriculum</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> 6 question types</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Auto-marking</div>
              </div>
            </motion.div>

            {/* Hero visual — a mock quiz card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur-2xl" />
              <Card className="relative shadow-2xl border-2 border-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Brain className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Fractions Quiz</div>
                        <div className="text-xs text-muted-foreground">Grade 7 · Mathematics</div>
                      </div>
                    </div>
                    <Badge className="bg-accent/15 text-accent hover:bg-accent/15">Auto-marked</Badge>
                  </div>

                  <div className="space-y-3">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="p-3 rounded-lg border bg-card text-sm"
                    >
                      <div className="text-xs text-muted-foreground mb-1">Q1 · Multiple Choice</div>
                      <div className="font-medium">What is 1/4 + 2/4?</div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                        <div className="px-2 py-1.5 rounded bg-muted/60 border">A. 3/8</div>
                        <div className="px-2 py-1.5 rounded bg-accent/15 border border-accent/30 text-accent font-medium">B. 3/4 ✓</div>
                        <div className="px-2 py-1.5 rounded bg-muted/60 border">C. 2/8</div>
                        <div className="px-2 py-1.5 rounded bg-muted/60 border">D. 3/16</div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 }}
                      className="p-3 rounded-lg border bg-card text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Q5 · Matching</div>
                          <div className="font-medium">Match fractions to simplified form</div>
                        </div>
                        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                          1.5 / 2
                        </Badge>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0 }}
                      className="mt-4 p-4 rounded-lg bg-gradient-to-r from-accent/15 to-primary/15 border border-primary/20"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">Result</div>
                          <div className="text-2xl font-bold text-foreground">91.7% · Grade A</div>
                        </div>
                        <Trophy className="h-10 w-10 text-accent" />
                      </div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>

              {/* Floating "auto-marked" indicator */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 }}
                className="absolute -top-4 -right-4 px-3 py-2 rounded-full bg-accent text-accent-foreground text-xs font-medium shadow-lg flex items-center gap-1.5"
              >
                Auto-marked
              </motion.div>
            </motion.div>
          </div>

          {/* === LIVE STATS === */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            {[
              { label: 'Active Learners', value: stats?.counts.learners ?? 0, icon: Users, color: 'text-primary' },
              { label: 'Teachers', value: stats?.counts.teachers ?? 0, icon: GraduationCap, color: 'text-accent' },
              { label: 'Published Lessons', value: stats?.counts.publishedLessons ?? 0, icon: BookOpen, color: 'text-chart-3' },
              { label: 'Published Quizzes', value: stats?.counts.publishedQuizzes ?? 0, icon: FileText, color: 'text-chart-4' },
              { label: 'Quiz Attempts', value: stats?.counts.attempts ?? 0, icon: BarChart3, color: 'text-chart-5' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <stat.icon className={`h-5 w-5 mb-2 ${stat.color}`} />
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {isLoading ? <span className="text-muted-foreground/40">…</span> : <AnimatedCounter value={stat.value} />}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* === FEATURES === */}
      <section id="features" className="py-16 sm:py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge variant="secondary" className="mb-3">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Everything a Zambian classroom needs
            </h2>
            <p className="text-muted-foreground">
              From auto quiz generation to instant auto-marking, EduQuest brings modern tools to every teacher and learner.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -4 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl mb-4 ${f.color}`}>
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* === SUBJECTS === */}
      <section id="subjects" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge variant="secondary" className="mb-3">Subjects</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Covering the full Zambian curriculum
            </h2>
            <p className="text-muted-foreground">
              {stats ? `${stats.subjects.length} subjects from primary to senior secondary` : 'A full range of subjects'} — each with its own lessons and quizzes.
            </p>
          </motion.div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(stats?.subjects ?? []).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
                          style={{ backgroundColor: s.color ?? 'var(--primary)' }}
                        >
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate">{s.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {s.lessonCount} lesson{s.lessonCount === 1 ? '' : 's'} · {s.quizCount} quiz{s.quizCount === 1 ? '' : 'zes'}
                          </div>
                        </div>
                      </div>
                      {s.description && (
                        <p className="mt-2.5 text-xs text-muted-foreground/80 line-clamp-2">{s.description}</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* === HOW IT WORKS === */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <Badge variant="secondary" className="mb-3">How it works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Three roles, one platform
            </h2>
            <p className="text-muted-foreground">
              From the admin office to the chalkboard to the learner's desk — EduQuest connects everyone.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative"
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                        {step.n}
                      </div>
                      <step.icon className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-muted-foreground/40">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* === TESTIMONIALS === */}
      <section id="testimonials" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge variant="secondary" className="mb-3">Voices from the field</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              What teachers are saying
            </h2>
            <p className="text-muted-foreground">
              Real quotes from teachers and administrators using EduQuest in Zambian classrooms.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="text-3xl text-primary/30 font-serif leading-none mb-2">"</div>
                    <p className="text-sm leading-relaxed mb-4 italic">{t.quote}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-border/60">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {t.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA === */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-8 sm:p-12 lg:p-16 text-primary-foreground"
          >
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to bring EduQuest to your classroom?
              </h2>
              <p className="text-primary-foreground/85 mb-6 text-lg">
                Sign in with a demo account to explore the admin, teacher, and learner dashboards. All demo passwords are <code className="px-1.5 py-0.5 rounded bg-white/15 text-sm font-mono">eduquest123</code>.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => setShowLogin(true)}
                >
                  Sign in to EduQuest
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/10 text-primary-foreground border-white/30 hover:bg-white/20 hover:text-primary-foreground"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Explore features
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="mt-auto border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="font-bold text-lg">EduQuest LMS</div>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                A Learning Management System built for Zambian primary and secondary schools. Aligned with the Zambian curriculum and ECZ examination standards.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#subjects" className="hover:text-foreground transition-colors">Subjects</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a></li>
                <li><button onClick={() => setShowLogin(true)} className="hover:text-foreground transition-colors">Sign in</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">For Zambian classrooms</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-accent" /> Grades 4–7</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-accent" /> ECZ examination standards</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-accent" /> Zambian curriculum</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-accent" /> Smart auto-marking</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>© {new Date().getFullYear()} EduQuest LMS · For Zambian classrooms</div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Built for African education</span>
            </div>
          </div>
        </div>
      </footer>

      {/* === LOGIN MODAL === */}
      <AnimatePresence>
        {showLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLogin(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 z-10 rounded-full bg-background shadow-md"
                  onClick={() => setShowLogin(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
                <LoginView embedded />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
