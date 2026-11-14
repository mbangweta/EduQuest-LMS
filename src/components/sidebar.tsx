'use client'

import { GraduationCap, LayoutDashboard, Users, Settings, BookOpen, FileText, FileQuestion, Library, BarChart3, FolderOpen, ClipboardList, School, CalendarDays, ArrowUpCircle, Briefcase, ScrollText, Megaphone, ClipboardCheck, Award, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from '@/lib/router'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  label: string
  view: string
  icon: React.ReactNode
}

const SUPER_USER_NAV: NavItem[] = [
  { label: 'Dashboard', view: 'super.dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Schools', view: 'super.schools', icon: <School className="h-4 w-4" /> },
  { label: 'Users', view: 'super.users', icon: <Users className="h-4 w-4" /> },
  { label: 'Library', view: 'super.library', icon: <Library className="h-4 w-4" /> },
  { label: 'Announcements', view: 'super.announcements', icon: <Megaphone className="h-4 w-4" /> },
  { label: 'Academic Years', view: 'super.academic-years', icon: <CalendarDays className="h-4 w-4" /> },
  { label: 'Audit Logs', view: 'super.audit-logs', icon: <ScrollText className="h-4 w-4" /> },
  { label: 'Settings', view: 'super.settings', icon: <Settings className="h-4 w-4" /> },
]

const SCHOOL_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', view: 'school-admin.dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Teachers', view: 'school-admin.teachers', icon: <GraduationCap className="h-4 w-4" /> },
  { label: 'Teacher Workload', view: 'school-admin.teacher-workload', icon: <Briefcase className="h-4 w-4" /> },
  { label: 'Classes', view: 'school-admin.classes', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Learners', view: 'school-admin.learners', icon: <Users className="h-4 w-4" /> },
  { label: 'Mark Schedules', view: 'school-admin.mark-schedules', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Report Cards', view: 'school-admin.report-cards', icon: <Award className="h-4 w-4" /> },
  { label: 'Promote Learners', view: 'school-admin.promote', icon: <ArrowUpCircle className="h-4 w-4" /> },
  { label: 'Library', view: 'school-admin.library', icon: <Library className="h-4 w-4" /> },
  { label: 'Announcements', view: 'school-admin.announcements', icon: <Megaphone className="h-4 w-4" /> },
  { label: 'Academic Years', view: 'school-admin.academic-years', icon: <CalendarDays className="h-4 w-4" /> },
  { label: 'Audit Logs', view: 'school-admin.audit-logs', icon: <ScrollText className="h-4 w-4" /> },
  { label: 'Settings', view: 'school-admin.settings', icon: <Settings className="h-4 w-4" /> },
]

// Legacy ADMIN — keep as a school-admin-style fallback.
const ADMIN_NAV: NavItem[] = SCHOOL_ADMIN_NAV

const TEACHER_NAV: NavItem[] = [
  { label: 'Dashboard', view: 'teacher.dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Classes', view: 'teacher.classes', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Lessons', view: 'teacher.lessons', icon: <FileText className="h-4 w-4" /> },
  { label: 'Quizzes', view: 'teacher.quizzes', icon: <FileQuestion className="h-4 w-4" /> },
  { label: 'Assessments', view: 'teacher.assessments', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Mark Schedule', view: 'teacher.mark-schedule', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Attendance', view: 'teacher.attendance', icon: <CalendarCheck className="h-4 w-4" /> },
  { label: 'Report Cards', view: 'teacher.report-cards', icon: <Award className="h-4 w-4" /> },
  { label: 'Question Bank', view: 'teacher.question-bank', icon: <Library className="h-4 w-4" /> },
  { label: 'Results', view: 'teacher.results', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Library', view: 'teacher.library', icon: <Library className="h-4 w-4" /> },
  { label: 'Announcements', view: 'teacher.announcements', icon: <Megaphone className="h-4 w-4" /> },
]

const LEARNER_NAV: NavItem[] = [
  { label: 'Dashboard', view: 'learner.dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'My Classes', view: 'learner.classes', icon: <FolderOpen className="h-4 w-4" /> },
  { label: 'Lessons', view: 'learner.lessons', icon: <FileText className="h-4 w-4" /> },
  { label: 'Quizzes', view: 'learner.quizzes', icon: <FileQuestion className="h-4 w-4" /> },
  { label: 'My Scores', view: 'learner.my-scores', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Report Card', view: 'learner.report-card', icon: <Award className="h-4 w-4" /> },
  { label: 'My Progress', view: 'learner.progress', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Library', view: 'learner.library', icon: <Library className="h-4 w-4" /> },
  { label: 'Announcements', view: 'learner.announcements', icon: <Megaphone className="h-4 w-4" /> },
]

type SidebarRole = 'SUPER_USER' | 'SCHOOL_ADMIN' | 'TEACHER' | 'LEARNER' | 'ADMIN'

export function Sidebar({ role }: { role: SidebarRole }) {
  const { view, navigate } = useRouter()
  const items =
    role === 'SUPER_USER' ? SUPER_USER_NAV
    : role === 'SCHOOL_ADMIN' ? SCHOOL_ADMIN_NAV
    : role === 'TEACHER' ? TEACHER_NAV
    : role === 'LEARNER' ? LEARNER_NAV
    : ADMIN_NAV

  const roleLabel =
    role === 'SUPER_USER' ? 'super user'
    : role === 'SCHOOL_ADMIN' ? 'school admin'
    : role === 'TEACHER' ? 'teacher'
    : role === 'LEARNER' ? 'learner'
    : 'admin'

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold text-sidebar-foreground">EduQuest</span>
          <span className="text-[10px] uppercase tracking-wide text-sidebar-foreground/60">LMS · Zambia</span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => {
            const active = view === item.view || view.startsWith(item.view + '.')
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3">
        <Badge variant="secondary" className="w-full justify-center capitalize">
          {roleLabel} account
        </Badge>
      </div>
    </div>
  )
}
