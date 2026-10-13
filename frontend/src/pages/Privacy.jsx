import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { PerformaMark, Sun, Moon } from '../components/icons';
import { Surface, PageGrid, Row, Col } from '../components/ui';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

const SECTIONS = [
  {
    title: 'What we collect',
    body: 'Account details (name, work email, role) and the probationary performance data your organization records in Performa: weekly competency ratings, monthly rollups, milestone dates and the evidentiary audit trail. We do not collect biometrics, punch-clock data, or leave requests.',
  },
  {
    title: 'Why we process it',
    body: 'To evaluate performance against the Article 296 (Philippine Labor Code) probation standard, to generate training recommendations, and to keep an immutable record of decisions for due process and labor-audit purposes.',
  },
  {
    title: 'Legal basis',
    body: 'Processing is necessary to comply with the employer\u2019s legal obligations under the Labor Code and to pursue its legitimate employment interests, and is carried out with the data subject\u2019s consent where required.',
  },
  {
    title: 'Who can see it',
    body: 'Access is role-based and tenant-scoped: an Employer sees their organization\u2019s records, a Supervisor sees their assigned direct reports, and an employee sees only their own record. System Administrators have no access to performance data.',
  },
  {
    title: 'How long we keep it',
    body: 'Evaluation and audit records are retained for the period required to defend decisions under labor law and applicable record-retention rules, after which they are removed.',
  },
  {
    title: 'Your rights (RA 10173)',
    body: 'You have the right to be informed, to access, to object, to correct, to erasure or blocking, to damages, and to lodge a complaint with the National Privacy Commission. Requests are made to your organization\u2019s Data Protection Officer.',
  },
];

export default function Privacy() {
  const { mode, setMode } = useTheme();

  return (
    <div className="login-shell min-h-screen w-full flex flex-col bg-bg text-ink transition-colors duration-performa">
      <PageGrid container className="flex-1 flex flex-col lg:grid-rows-[auto_1fr_auto]">
        <Row as="header" className="lg:items-center flex justify-between items-center gap-4 py-6">
          <Col span={5} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-nav bg-accent text-accent-foreground flex items-center justify-center">
              <PerformaMark className="w-5 h-5" />
            </div>
            <span className="font-semibold text-16 tracking-tight text-ink">Performa</span>
          </Col>
          <Col
            span={6}
            start={7}
            role="group"
            aria-label="Color mode"
            className="lg:justify-self-end flex items-center gap-1 p-1 rounded-ctl border border-line bg-hover"
          >
            {MODES.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${m.label} mode`}
                  title={m.label}
                  onClick={() => setMode(m.id)}
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-ctl transition-colors ${
                    isActive ? 'bg-surface text-ink border border-line' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </Col>
        </Row>

              <Row as="main" className="page-enter flex-1 pb-12">
          <Col as="section" span={8}>
            <h1 className="text-30 font-semibold tracking-tight text-ink">Data Privacy Notice</h1>
            <p className="text-14 text-ink-2 mt-2">
              How Performa processes personal and performance data, in line with the Philippine Data
              Privacy Act of 2012 (RA 10173).
            </p>

            <div className="mt-7 divide-y divide-line">
              {SECTIONS.map((s) => (
                <div key={s.title} className="py-5 first:pt-0">
                  <h2 className="text-14 font-semibold text-ink">{s.title}</h2>
                  <p className="mt-1 text-14 leading-relaxed text-ink-2">{s.body}</p>
                </div>
              ))}
            </div>

            <Surface flat className="mt-6 p-4">
              <p className="text-14 text-ink-2">
                For access, correction, or erasure requests, contact your organization&rsquo;s Data
                Protection Officer.
              </p>
            </Surface>

            <p className="text-14 text-ink-2 mt-6">
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </Col>
        </Row>

        <Row as="footer" className="py-6 text-12 text-ink-3">
          <Col span={5}>Asia/Manila (UTC+8) · Article 296, Philippine Labor Code</Col>
        </Row>
      </PageGrid>
    </div>
  );
}
