'use client'

import { useRouter } from '@/lib/router'
import { useCurrentUser } from '@/hooks/use-current-user'
import { AdminDashboard } from '@/components/views/admin/admin-dashboard'
import { AdminUsersView } from '@/components/views/admin/admin-users-view'
import { AdminClassesView } from '@/components/views/admin/admin-classes-view'
import { AdminSettingsView } from '@/components/views/admin/admin-settings-view'
import { TeacherDashboard } from '@/components/views/teacher/teacher-dashboard'
import { TeacherClassesView } from '@/components/views/teacher/teacher-classes-view'
import { TeacherClassDetailView } from '@/components/views/teacher/teacher-class-detail-view'
import { TeacherLessonsView } from '@/components/views/teacher/teacher-lessons-view'
import { TeacherLessonEditorView } from '@/components/views/teacher/teacher-lesson-editor-view'
import { TeacherQuizzesView } from '@/components/views/teacher/teacher-quizzes-view'
import { TeacherQuizEditorView } from '@/components/views/teacher/teacher-quiz-editor-view'
import { TeacherQuestionBankView } from '@/components/views/teacher/teacher-question-bank-view'
import { TeacherQuizResultsView } from '@/components/views/teacher/teacher-quiz-results-view'
import { TeacherAssessmentsView } from '@/components/views/teacher/teacher-assessments-view'
import { TeacherAssessmentEditorView } from '@/components/views/teacher/teacher-assessment-editor-view'
import { TeacherMarkScheduleView } from '@/components/views/teacher/teacher-mark-schedule-view'
import { TeacherAttendanceView } from '@/components/views/teacher/teacher-attendance-view'
import { TeacherReportCardsView } from '@/components/views/teacher/teacher-report-cards-view'
import { LearnerDashboard } from '@/components/views/learner/learner-dashboard'
import { LearnerClassesView } from '@/components/views/learner/learner-classes-view'
import { LearnerLessonsView } from '@/components/views/learner/learner-lessons-view'
import { LearnerLessonView } from '@/components/views/learner/learner-lesson-view'
import { LearnerQuizzesView } from '@/components/views/learner/learner-quizzes-view'
import { LearnerQuizTakeView } from '@/components/views/learner/learner-quiz-take-view'
import { LearnerQuizResultsView } from '@/components/views/learner/learner-quiz-results-view'
import { LearnerProgressView } from '@/components/views/learner/learner-progress-view'
import { LearnerClassDetailView } from '@/components/views/learner/learner-class-detail-view'
import { LearnerMyScoresView } from '@/components/views/learner/learner-my-scores-view'
import { LearnerReportCardView } from '@/components/views/learner/learner-report-card-view'

// New role-aware views
import { SuperDashboardView } from '@/components/views/super/super-dashboard-view'
import { SuperSchoolsView } from '@/components/views/super/super-schools-view'
import { SuperUsersView } from '@/components/views/super/super-users-view'
import { LibraryView } from '@/components/views/shared/library-view'
import { SchoolAdminDashboardView } from '@/components/views/school-admin/school-admin-dashboard-view'
import { SchoolAdminTeachersView } from '@/components/views/school-admin/school-admin-teachers-view'
import { SchoolAdminClassesView } from '@/components/views/school-admin/school-admin-classes-view'
import { SchoolAdminLearnersView } from '@/components/views/school-admin/school-admin-learners-view'
import { SchoolAdminSettingsView } from '@/components/views/school-admin/school-admin-settings-view'
import { SchoolAdminPromoteView } from '@/components/views/school-admin/school-admin-promote-view'
import { SchoolAdminTeacherWorkloadView } from '@/components/views/school-admin/school-admin-teacher-workload-view'
import { SchoolAdminMarkSchedulesView } from '@/components/views/school-admin/school-admin-mark-schedules-view'
import { SchoolAdminReportCardsView } from '@/components/views/school-admin/school-admin-report-cards-view'
import { AcademicYearsView } from '@/components/views/shared/academic-years-view'
import { AuditLogsView } from '@/components/views/shared/audit-logs-view'
import { AnnouncementsView } from '@/components/views/shared/announcements-view'

export function ViewRenderer() {
  const { view, params } = useRouter()
  const { user } = useCurrentUser()

  if (!user) return null

  // SUPER_USER views
  if (view === 'super.dashboard') return <SuperDashboardView />
  if (view === 'super.schools') return <SuperSchoolsView />
  if (view === 'super.users') return <SuperUsersView />
  if (view === 'super.library') return <LibraryView scope="super" />
  if (view === 'super.academic-years') return <AcademicYearsView />
  if (view === 'super.audit-logs') return <AuditLogsView />
  if (view === 'super.announcements') return <AnnouncementsView />
  if (view === 'super.settings') return <AdminSettingsView />

  // SCHOOL_ADMIN views
  if (view === 'school-admin.dashboard') return <SchoolAdminDashboardView />
  if (view === 'school-admin.teachers') return <SchoolAdminTeachersView />
  if (view === 'school-admin.teacher-workload') return <SchoolAdminTeacherWorkloadView />
  if (view === 'school-admin.classes') return <SchoolAdminClassesView />
  if (view === 'school-admin.learners') return <SchoolAdminLearnersView />
  if (view === 'school-admin.promote') return <SchoolAdminPromoteView />
  if (view === 'school-admin.mark-schedules') return <SchoolAdminMarkSchedulesView />
  if (view === 'school-admin.report-cards') return <SchoolAdminReportCardsView />
  if (view === 'school-admin.library') return <LibraryView scope="school-admin" />
  if (view === 'school-admin.academic-years') return <AcademicYearsView />
  if (view === 'school-admin.audit-logs') return <AuditLogsView />
  if (view === 'school-admin.announcements') return <AnnouncementsView />
  if (view === 'school-admin.settings') return <SchoolAdminSettingsView />

  // Shared Library view for TEACHER + LEARNER
  if (view === 'teacher.library') return <LibraryView scope="teacher" />
  if (view === 'teacher.announcements') return <AnnouncementsView />
  if (view === 'learner.library') return <LibraryView scope="learner" />
  if (view === 'learner.announcements') return <AnnouncementsView />

  // Legacy ADMIN views — route to the new role-aware dashboards for the new roles.
  if (view === 'admin.dashboard') {
    return user.role === 'SUPER_USER' ? <SuperDashboardView /> : <SchoolAdminDashboardView />
  }
  if (view === 'admin.users') {
    return user.role === 'SUPER_USER' ? <SuperUsersView /> : <AdminUsersView />
  }
  if (view === 'admin.classes' || view === 'admin.class-detail') return <AdminClassesView />
  if (view === 'admin.settings') {
    return user.role === 'SCHOOL_ADMIN' ? <SchoolAdminSettingsView /> : <AdminSettingsView />
  }

  // TEACHER views (existing)
  if (view === 'teacher.dashboard') return <TeacherDashboard />
  if (view === 'teacher.classes') return <TeacherClassesView />
  if (view === 'teacher.class-detail') return <TeacherClassDetailView classId={params.classId} />
  if (view === 'teacher.lessons') return <TeacherLessonsView />
  if (view === 'teacher.lesson-editor') return <TeacherLessonEditorView lessonId={params.lessonId} />
  if (view === 'teacher.quizzes') return <TeacherQuizzesView />
  if (view === 'teacher.quiz-editor') return <TeacherQuizEditorView quizId={params.quizId} />
  if (view === 'teacher.question-bank') return <TeacherQuestionBankView />
  if (view === 'teacher.quiz-results' || view === 'teacher.results') return <TeacherQuizResultsView quizId={params.quizId} />
  if (view === 'teacher.assessments') return <TeacherAssessmentsView />
  if (view === 'teacher.assessment-editor') return <TeacherAssessmentEditorView assessmentId={params.assessmentId} />
  if (view === 'teacher.mark-schedule') return <TeacherMarkScheduleView />
  if (view === 'teacher.attendance') return <TeacherAttendanceView />
  if (view === 'teacher.report-cards') return <TeacherReportCardsView />

  // LEARNER views (existing)
  if (view === 'learner.dashboard') return <LearnerDashboard />
  if (view === 'learner.classes') return <LearnerClassesView />
  if (view === 'learner.class-detail') return <LearnerClassDetailView classId={params.classId} />
  if (view === 'learner.lessons') return <LearnerLessonsView />
  if (view === 'learner.lesson-view') return <LearnerLessonView lessonId={params.lessonId} />
  if (view === 'learner.quizzes') return <LearnerQuizzesView />
  if (view === 'learner.quiz-take') return <LearnerQuizTakeView quizId={params.quizId} />
  if (view === 'learner.quiz-results') return <LearnerQuizResultsView attemptId={params.attemptId} />
  if (view === 'learner.progress') return <LearnerProgressView />
  if (view === 'learner.my-scores') return <LearnerMyScoresView />
  if (view === 'learner.report-card') return <LearnerReportCardView />

  // Default fallback: role dashboard
  if (user.role === 'SUPER_USER') return <SuperDashboardView />
  if (user.role === 'SCHOOL_ADMIN') return <SchoolAdminDashboardView />
  if (user.role === 'ADMIN') return <AdminDashboard />
  if (user.role === 'TEACHER') return <TeacherDashboard />
  return <LearnerDashboard />
}
