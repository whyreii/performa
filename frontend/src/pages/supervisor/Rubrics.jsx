import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { kpiApi } from '../../api';
import { Target, ShieldCheck, Award, BookOpen, AlertCircle } from 'lucide-react';
import { Badge } from '../../components/ui';

export default function Rubrics() {
  const { data: dbRubrics = [], isError: isRubricsError } = useQuery({
    queryKey: ['kpi-rubrics'],
    queryFn: () => kpiApi.list(),
  });
  const rubricMap = Object.fromEntries(dbRubrics.map((r) => [r.competency, r]));

  const rubrics = [
    {
      id: 'task',
      competency: 'task_completion',
      name: '1. Task Completion & Work Output',
      weight: '20%',
      target: '4.0',
      desc: 'Execution of core job responsibilities, volume of throughput, and adherence to assigned sprint deadlines.',
      levels: [
        { score: '1.0 - 2.9', title: 'Unsatisfactory', text: 'Consistently misses deadlines; output volume significantly below department baseline.' },
        { score: '3.0 - 3.9', title: 'Developing', text: 'Meets basic volume requirements; occasionally requires supervisory escalation on complex items.' },
        { score: '4.0 - 4.5', title: 'Proficient (Target)', text: 'Consistently completes full work quotas on schedule with minimal oversight.' },
        { score: '4.6 - 5.0', title: 'Exemplary', text: 'Exceeds output goals; proactively unblocks team members and streamlines workflows.' },
      ],
    },
    {
      id: 'quality',
      competency: 'quality_of_work',
      name: '2. Quality of Work & Accuracy',
      weight: '20%',
      target: '4.0',
      desc: 'Attention to detail, low error rate, and strict compliance with company operational standards and SOPs.',
      levels: [
        { score: '1.0 - 2.9', title: 'Unsatisfactory', text: 'Frequent errors requiring re-work; fails to follow documented quality checklists.' },
        { score: '3.0 - 3.9', title: 'Developing', text: 'Acceptable precision on routine tasks; minor oversights on non-routine deliverables.' },
        { score: '4.0 - 4.5', title: 'Proficient (Target)', text: 'Deliverables are accurate, thoroughly checked, and comply with all specifications.' },
        { score: '4.6 - 5.0', title: 'Exemplary', text: 'Flawless execution; identifies and resolves system errors before they reach stakeholders.' },
      ],
    },
    {
      id: 'attendance',
      competency: 'attendance_and_punctuality',
      name: '3. Attendance & Punctuality',
      weight: '20%',
      target: '4.0',
      desc: 'On-time shift arrival, dependability during scheduled operational hours, and proper leave compliance.',
      levels: [
        { score: '1.0 - 2.9', title: 'Unsatisfactory', text: 'Repeated unexcused tardiness or unscheduled absences; disrupts shift coverage.' },
        { score: '3.0 - 3.9', title: 'Developing', text: 'Infrequent tardiness; reports unavoidable delays in accordance with policy.' },
        { score: '4.0 - 4.5', title: 'Proficient (Target)', text: 'Exemplary attendance record; always ready to start work promptly at scheduled hours.' },
        { score: '4.6 - 5.0', title: 'Exemplary', text: '100% punctuality; flexible to assist in covering emergency team shifts.' },
      ],
    },
    {
      id: 'communication',
      competency: 'communication_and_teamwork',
      name: '4. Communication & Teamwork',
      weight: '20%',
      target: '4.0',
      desc: 'Constructive cross-functional collaboration, transparency, courteous peer relations, and responsiveness.',
      levels: [
        { score: '1.0 - 2.9', title: 'Unsatisfactory', text: 'Displays friction with colleagues; fails to communicate status or blockers.' },
        { score: '3.0 - 3.9', title: 'Developing', text: 'Communicates clearly on individual tasks; participates adequately in team meetings.' },
        { score: '4.0 - 4.5', title: 'Proficient (Target)', text: 'Constructive collaborator; listens actively and resolves issues professionally.' },
        { score: '4.6 - 5.0', title: 'Exemplary', text: 'Fosters team morale; bridges communication between departments effectively.' },
      ],
    },
    {
      id: 'initiative',
      competency: 'initiative_and_adaptability',
      name: '5. Initiative & Adaptability',
      weight: '20%',
      target: '4.0',
      desc: 'Self-driven problem resolution, openness to coaching, and agility when organizational needs shift.',
      levels: [
        { score: '1.0 - 2.9', title: 'Unsatisfactory', text: 'Resistant to feedback; requires constant step-by-step guidance without independent thought.' },
        { score: '3.0 - 3.9', title: 'Developing', text: 'Accepts coaching willingly; adapts to procedural changes after initial guidance.' },
        { score: '4.0 - 4.5', title: 'Proficient (Target)', text: 'Proactive problem solver; applies constructive feedback quickly to improve performance.' },
        { score: '4.6 - 5.0', title: 'Exemplary', text: 'Anticipates challenges; introduces novel solutions and mentors peers proactively.' },
      ],
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <header className="pb-5 border-b border-line">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
          KPI Performance Rubrics
        </h1>
        <p className="text-sm text-ink-2 mt-1">
          The 5 Statutory Competencies & Regularizing Benchmarks · Philippine Labor Code Art. 296
        </p>
      </header>

      {isRubricsError && (
        <div className="p-3 rounded-ctl bg-warn/8 border border-line text-warn text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Could not load your configured targets/weights right now — showing platform defaults.
          </span>
        </div>
      )}

      {/* Legal Banner */}
      <section className="bg-surface border border-line rounded-float p-5 space-y-2 shadow-sm">
        <div className="flex items-center gap-2 text-accent font-semibold text-xs">
          <ShieldCheck className="w-4 h-4" />
          <span className="uppercase tracking-wider font-mono text-[11px]">
            Statutory Legal Basis (Aliling v. Feliciano / Tamson Doctrine)
          </span>
        </div>
        <p className="text-xs text-ink-2 leading-relaxed">
          In Philippine labor law, reasonable standards of performance must be made known to the employee at the time of engagement (Day 1). Ratings assigned in weekly evaluations directly enforce these communicated criteria.
        </p>
      </section>

      {/* Rubrics Grid */}
      <div className="space-y-6">
        {rubrics.map((rubric) => (
          <div
            key={rubric.id}
            className="bg-surface border border-line rounded-float p-6 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
              <div>
                <h2 className="text-base font-semibold text-ink">{rubric.name}</h2>
                <p className="text-xs text-ink-3 mt-0.5">{rubric.desc}</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center font-mono text-xs">
                <Badge variant="neutral">
                  Weight:{' '}
                  {rubricMap[rubric.competency]
                    ? `${Math.round(rubricMap[rubric.competency].weight * 100)}%`
                    : rubric.weight}
                </Badge>
                <Badge variant="ok">
                  Target:{' '}
                  {rubricMap[rubric.competency]
                    ? rubricMap[rubric.competency].target_score.toFixed(1)
                    : rubric.target}{' '}
                  / 5.0
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {rubric.levels.map((lvl) => (
                <div
                  key={lvl.score}
                  className={`p-3 rounded-ctl border text-xs space-y-2 ${
                    lvl.title.includes('Target')
                      ? 'bg-ok/5 border-line'
                      : 'bg-hover/60 border-line'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-ink">{lvl.score}</span>
                    <span
                      className={`text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded ${
                        lvl.title.includes('Target')
                          ? 'bg-ok/20 text-ok'
                          : lvl.title.includes('Unsatisfactory')
                          ? 'bg-bad/10 text-bad'
                          : 'bg-ink-3/10 text-ink-3'
                      }`}
                    >
                      {lvl.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-2 leading-relaxed">{lvl.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
