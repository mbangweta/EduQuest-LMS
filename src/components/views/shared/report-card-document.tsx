'use client'

import { Printer, Award, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/views/shared/empty-state'
import { gradeColorClass } from '@/lib/assessment-utils'

const TYPE_COLUMNS = ['TEST 1', 'TEST 2', 'TEST 3', 'END TERM'] as const

/**
 * ReportCardDocument — renders a printable report card matching the
 * Zambian school report card format (Chudleigh House style).
 *
 * Used by both the learner's own report card view and the teacher's/
 * admin's report card generator.
 */
export function ReportCardDocument({ report }: { report: any }) {
  if (!report || !report.subjects || report.subjects.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap className="h-6 w-6" />}
        title="No report yet"
        description="No published scores have been recorded yet."
      />
    )
  }

  const school = report.school
  const className = report.class?.name || `Grade ${report.learner.grade}`
  const teacherName = report.class?.teacherName || '—'
  const termLabel = report.term ? `End of Term ${report.term}` : 'All Terms'
  const year = new Date().getFullYear()

  return (
    <div className="bg-white text-black max-w-4xl mx-auto print:shadow-none shadow-sm border rounded-lg overflow-hidden">
      {/* === HEADER === */}
      <div className="text-center py-6 border-b-2 border-black">
        {school?.logoUrl && (
          <img src={school.logoUrl} alt="School logo" className="h-16 w-16 mx-auto mb-2 object-contain" />
        )}
        <h1 className="text-2xl font-bold uppercase tracking-wide">{school?.name || 'EduQuest School'}</h1>
        {school?.motto && (
          <p className="text-sm italic text-gray-600 mt-1">&ldquo;{school.motto}&rdquo;</p>
        )}
        <h2 className="text-lg font-semibold uppercase mt-3">Primary School Report Card</h2>
        <p className="text-sm text-gray-700 mt-1">{termLabel} Examination {year}</p>
      </div>

      {/* === STUDENT DETAILS === */}
      <div className="px-6 py-4 border-b border-gray-300">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div><span className="font-semibold">Name:</span> {report.learner.name}</div>
          <div><span className="font-semibold">Class:</span> {className}</div>
          <div><span className="font-semibold">Teacher:</span> {teacherName}</div>
        </div>
      </div>

      {/* === ACADEMIC PERFORMANCE === */}
      <div className="px-6 py-4">
        <h3 className="text-sm font-bold uppercase mb-2 border-b border-gray-400 pb-1">Academic Performance</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-700">
              <th className="text-left py-2 px-2 font-semibold border-r border-gray-300">Subject</th>
              {TYPE_COLUMNS.map((col) => (
                <th key={col} className="text-center py-2 px-2 font-semibold border-r border-gray-300">{col}</th>
              ))}
              <th className="text-center py-2 px-2 font-semibold border-r border-gray-300">Term Avg</th>
              <th className="text-center py-2 px-2 font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody>
            {report.subjects.map((s: any, idx: number) => (
              <>
                <tr key={s.subject.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-2 px-2 font-medium border-r border-gray-300 border-t">{s.subject.name}</td>
                  {TYPE_COLUMNS.map((col) => {
                    const v = s.scoresByType?.[col]
                    return (
                      <td key={col} className="text-center py-2 px-2 border-r border-gray-300 border-t">
                        {v === null || v === undefined ? '—' : v}
                      </td>
                    )
                  })}
                  <td className="text-center py-2 px-2 font-semibold border-r border-gray-300 border-t">
                    {s.termAverage === null ? '—' : s.termAverage}
                  </td>
                  <td className="text-center py-2 px-2 border-t">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${gradeColorClass(s.grade)}`}>
                      {s.grade}
                    </span>
                  </td>
                </tr>
                <tr key={s.subject.id + '-remark'} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td colSpan={8} className="py-1 px-2 text-xs italic text-gray-600 border-r border-gray-300 border-t">
                    Remark: {s.remark}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-700 font-semibold">
              <td className="py-2 px-2" colSpan={5}>Summary</td>
              <td className="text-center py-2 px-2 border-r border-gray-300">Pupil: {report.summary?.pupilTotal ?? '—'}</td>
              <td className="text-center py-2 px-2 border-r border-gray-300">Class Avg: {report.summary?.classAverage ?? '—'}</td>
              <td className="text-center py-2 px-2">{report.summary?.overallGrade ?? '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* === TEACHER COMMENT === */}
      <div className="px-6 py-4 border-t border-gray-300">
        <h3 className="text-sm font-bold uppercase mb-2">Class Teacher&apos;s General Comment</h3>
        <p className="text-sm text-gray-800 italic mb-2">{report.teacherComment}</p>
        <p className="text-sm"><span className="font-semibold">Class Teacher:</span> {teacherName}</p>
      </div>

      {/* === HEADTEACHER APPROVAL === */}
      <div className="px-6 py-4 border-t border-gray-300">
        <h3 className="text-sm font-bold uppercase mb-2">Headteacher&apos;s Approval</h3>
        <div className="border-b border-gray-400 mt-6 mb-1 w-64">&nbsp;</div>
        <p className="text-xs text-gray-500">Signature</p>
      </div>

      {/* === GRADING SCALE === */}
      <div className="px-6 py-4 border-t border-gray-300">
        <h3 className="text-sm font-bold uppercase mb-2">Grading Scale</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400">
              <th className="text-left py-1 px-2">Grade</th>
              <th className="text-left py-1 px-2">Range</th>
              <th className="text-left py-1 px-2">Remark</th>
            </tr>
          </thead>
          <tbody>
            {(report.gradingScale || []).map((g: any) => (
              <tr key={g.grade} className="border-b border-gray-200">
                <td className="py-1 px-2"><span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${gradeColorClass(g.grade)}`}>{g.grade}</span></td>
                <td className="py-1 px-2">{g.range}</td>
                <td className="py-1 px-2">{g.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === FOOTER === */}
      <div className="px-6 py-4 border-t-2 border-gray-700 text-center text-xs text-gray-600">
        {school && (
          <>
            <p className="font-semibold">{school.name}</p>
            {school.address && <p>{school.address}</p>}
            {(school.phone || school.email) && (
              <p>
                {school.phone && `Tel: ${school.phone}`}
                {school.phone && school.email && ' | '}
                {school.email && `Email: ${school.email}`}
              </p>
            )}
            {school.website && <p>Website: {school.website}</p>}
          </>
        )}
      </div>
    </div>
  )
}
