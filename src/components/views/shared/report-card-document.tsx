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
 * Zambian school report card format.
 *
 * Layout (single A4 page):
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  [motto]                                       [LOGO]        │  ← header
 *   │  SCHOOL NAME                                                │
 *   │  Primary School Report Card                                 │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Name: ___    Class: ___    Teacher: ___    Grade: ___       │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │            (faded watermark of logo behind table)           │
 *   │  Academic Performance table:                                │
 *   │   SUBJECT | TEST 1 | TEST 2 | TEST 3 | END TERM | Avg | G    │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Summary: Term Total | Class Avg | Overall Grade            │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Class Teacher's Comment                                    │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Headteacher's Approval                                     │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Grading Scale | Footer (school contact)                    │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Used by both the learner's own report card view and the teacher's/
 * admin's report card generator. Print-to-PDF produces one A4 page.
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
  const termLabel = report.term ? `End of Term ${report.term}` : 'End of Term'
  const logoUrl = school?.logoUrl || ''

  // "Term Total" is the canonical summary value per spec; fall back to pupilTotal
  // (kept for backwards compat with the old API response shape).
  const termTotal = report.summary?.termTotal ?? report.summary?.pupilTotal ?? null
  const classAverage = report.summary?.classAverage ?? null
  const overallGrade = report.summary?.overallGrade ?? '—'

  return (
    <div
      className="report-card-a4 bg-white text-black mx-auto shadow-sm border border-gray-300 print:shadow-none"
      style={{
        // A4 portrait at 96dpi ≈ 794×1123px. We target a touch under to leave
        // a safe margin so the document always fits on a single A4 page when
        // printed (Chrome / Edge / Vercel PDF renderer).
        width: '794px',
        minHeight: '1123px',
        maxWidth: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, "Noto Sans", Arial, sans-serif',
      }}
    >
      {/* === Faded center watermark (school logo) === */}
      {logoUrl && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '380px',
            height: '380px',
            opacity: 0.06,
            pointerEvents: 'none',
            zIndex: 0,
            backgroundImage: `url(${logoUrl})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* All content sits above the watermark */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* === HEADER === */}
        {/* Logo on the RIGHT, school name centered-ish on the left.
            Layout: two columns — left = motto + school name + subtitle,
            right = logo (max 96×96 px). */}
        <div
          className="border-b-2 border-black"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            gap: '16px',
          }}
        >
          <div style={{ flex: 1, textAlign: 'left' }}>
            {school?.motto && (
              <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#555', margin: '0 0 4px 0' }}>
                &ldquo;{school.motto}&rdquo;
              </p>
            )}
            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: 0,
              lineHeight: 1.15,
            }}>
              {school?.name || 'EduQuest School'}
            </h1>
            <h2 style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              margin: '6px 0 0 0',
              color: '#222',
            }}>
              Primary School Report Card
            </h2>
            <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0 0' }}>
              {termLabel}
            </p>
          </div>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="School logo"
              style={{
                height: '90px',
                width: '90px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* === STUDENT DETAILS === */}
        <div
          className="border-b border-gray-300"
          style={{ padding: '10px 32px', fontSize: '12px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px' }}>
            <div><span style={{ fontWeight: 600 }}>Name:</span> {report.learner.name}</div>
            <div><span style={{ fontWeight: 600 }}>Class:</span> {className}</div>
            <div><span style={{ fontWeight: 600 }}>Grade:</span> {report.learner.grade}</div>
            <div><span style={{ fontWeight: 600 }}>Teacher:</span> {teacherName}</div>
          </div>
        </div>

        {/* === ACADEMIC PERFORMANCE === */}
        <div style={{ padding: '10px 32px' }}>
          <h3 style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            margin: '0 0 6px 0',
            borderBottom: '1px solid #999',
            paddingBottom: '3px',
          }}>
            Academic Performance
          </h3>
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ textAlign: 'left', padding: '4px 4px', fontWeight: 600, borderRight: '1px solid #ccc' }}>Subject</th>
                {TYPE_COLUMNS.map((col) => (
                  <th key={col} style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 600, borderRight: '1px solid #ccc' }}>{col}</th>
                ))}
                <th style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 600, borderRight: '1px solid #ccc' }}>Term Avg</th>
                <th style={{ textAlign: 'center', padding: '4px 4px', fontWeight: 600 }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {report.subjects.map((s: any, idx: number) => (
                <>
                  <tr key={s.subject.id} style={{ background: idx % 2 === 0 ? '#f5f5f5' : 'white' }}>
                    <td style={{ padding: '3px 4px', fontWeight: 500, borderRight: '1px solid #ccc', borderTop: '1px solid #ddd' }}>
                      {s.subject.name}
                    </td>
                    {TYPE_COLUMNS.map((col) => {
                      const v = s.scoresByType?.[col]
                      return (
                        <td key={col} style={{ textAlign: 'center', padding: '3px 4px', borderRight: '1px solid #ccc', borderTop: '1px solid #ddd' }}>
                          {v === null || v === undefined ? '—' : v}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600, borderRight: '1px solid #ccc', borderTop: '1px solid #ddd' }}>
                      {s.termAverage === null ? '—' : s.termAverage}
                    </td>
                    <td style={{ textAlign: 'center', padding: '3px 4px', borderTop: '1px solid #ddd' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontSize: '9px',
                          fontWeight: 700,
                          border: `1px solid ${gradeBorderColor(s.grade)}`,
                          background: gradeBgColor(s.grade),
                          color: gradeTextColor(s.grade),
                        }}
                      >
                        {s.grade}
                      </span>
                    </td>
                  </tr>
                  <tr key={s.subject.id + '-remark'} style={{ background: idx % 2 === 0 ? '#f5f5f5' : 'white' }}>
                    <td colSpan={8} style={{ padding: '2px 4px', fontSize: '9px', fontStyle: 'italic', color: '#666', borderRight: '1px solid #ccc', borderTop: '1px solid #eee' }}>
                      Remark: {s.remark}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #333', fontWeight: 700, fontSize: '11px' }}>
                <td style={{ padding: '5px 4px' }} colSpan={5}>Summary</td>
                <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #ccc' }}>
                  Term Total: {termTotal === null ? '—' : termTotal}
                </td>
                <td style={{ textAlign: 'center', padding: '5px 4px', borderRight: '1px solid #ccc' }}>
                  Class Avg: {classAverage === null ? '—' : classAverage}
                </td>
                <td style={{ textAlign: 'center', padding: '5px 4px' }}>{overallGrade}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* === TEACHER COMMENT === */}
        <div style={{ padding: '8px 32px', borderTop: '1px solid #ccc' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px 0' }}>
            Class Teacher&apos;s General Comment
          </h3>
          <p style={{ fontSize: '10px', color: '#333', fontStyle: 'italic', margin: '0 0 4px 0', lineHeight: 1.4 }}>
            {report.teacherComment}
          </p>
          <p style={{ fontSize: '10px', margin: 0 }}>
            <span style={{ fontWeight: 600 }}>Class Teacher:</span> {teacherName}
          </p>
        </div>

        {/* === HEADTEACHER APPROVAL === */}
        <div style={{ padding: '8px 32px', borderTop: '1px solid #ccc' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px 0' }}>
            Headteacher&apos;s Approval
          </h3>
          <div style={{ borderBottom: '1px solid #999', marginTop: '18px', marginBottom: '2px', width: '220px' }}>&nbsp;</div>
          <p style={{ fontSize: '9px', color: '#777', margin: 0 }}>Signature</p>
        </div>

        {/* === GRADING SCALE === */}
        <div style={{ padding: '8px 32px', borderTop: '1px solid #ccc' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px 0' }}>
            Grading Scale
          </h3>
          <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #999' }}>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Grade</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Range</th>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {(report.gradingScale || []).map((g: any) => (
                <tr key={g.grade} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '2px 4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0 4px',
                        borderRadius: '2px',
                        fontSize: '8px',
                        fontWeight: 700,
                        border: `1px solid ${gradeBorderColor(g.grade)}`,
                        background: gradeBgColor(g.grade),
                        color: gradeTextColor(g.grade),
                      }}
                    >
                      {g.grade}
                    </span>
                  </td>
                  <td style={{ padding: '2px 4px' }}>{g.range}</td>
                  <td style={{ padding: '2px 4px' }}>{g.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* === FOOTER === */}
        <div
          style={{
            padding: '8px 32px',
            borderTop: '2px solid #333',
            textAlign: 'center',
            fontSize: '9px',
            color: '#666',
          }}
        >
          {school && (
            <>
              <p style={{ fontWeight: 600, margin: '0 0 2px 0' }}>{school.name}</p>
              {school.address && <p style={{ margin: 0 }}>{school.address}</p>}
              {(school.phone || school.secondaryPhone || school.email) && (
                <p style={{ margin: 0 }}>
                  {school.phone && `Tel: ${school.phone}`}
                  {school.phone && school.secondaryPhone && ` | ${school.secondaryPhone}`}
                  {(school.phone || school.secondaryPhone) && school.email && ' | '}
                  {school.email && `Email: ${school.email}`}
                </p>
              )}
              {school.website && <p style={{ margin: 0 }}>Website: {school.website}</p>}
            </>
          )}
        </div>
      </div>

      {/* Print styles: force one A4 page per report card */}
      <style jsx>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          .report-card-a4 {
            width: 210mm !important;
            min-height: 297mm !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  )
}

// Inline color helpers — kept here (not in assessment-utils) because they
// return hex/rgb for inline styles on the print-only report card. The
// Tailwind gradeColorClass() is still used by other (non-print) UI.
function gradeBorderColor(grade: string): string {
  switch (grade) {
    case 'A': return '#a7f3d0'
    case 'B': return '#bfdbfe'
    case 'C': return '#99f6e4'
    case 'D': return '#fde68a'
    case 'E': return '#fed7aa'
    case 'F': return '#fecaca'
    default: return '#e5e7eb'
  }
}
function gradeBgColor(grade: string): string {
  switch (grade) {
    case 'A': return '#ecfdf5'
    case 'B': return '#eff6ff'
    case 'C': return '#f0fdfa'
    case 'D': return '#fffbeb'
    case 'E': return '#fff7ed'
    case 'F': return '#fef2f2'
    default: return '#f9fafb'
  }
}
function gradeTextColor(grade: string): string {
  switch (grade) {
    case 'A': return '#065f46'
    case 'B': return '#1e40af'
    case 'C': return '#115e59'
    case 'D': return '#92400e'
    case 'E': return '#9a3412'
    case 'F': return '#991b1b'
    default: return '#374151'
  }
}
