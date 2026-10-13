import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kpiApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TARGET, COMPETENCIES } from '../../config/domain';
import { AlertCircle } from '../../components/icons';
import { Card, Page, Button, Badge, inputClass, SectionHead } from '../../components/ui';

// Fallback weight used only when the API has not provisioned a tenant default yet.
const DEFAULT_WEIGHT = 0.2;

// "retail" -> "Retail", "bpo" -> "BPO", "food_service" -> "Food Service".
const prettyTemplate = (key) =>
  key
    .split('_')
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');

export default function Rubrics() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'employer';

  const { data: dbRubrics = [], isError: isRubricsError } = useQuery({
    queryKey: ['kpi-rubrics'],
    queryFn: () => kpiApi.list(),
  });

  // Industry template presets are only needed by the role that can apply them.
  const { data: templates = {} } = useQuery({
    queryKey: ['kpi-templates'],
    queryFn: () => kpiApi.templates(),
    enabled: canEdit,
  });

  const [form, setForm] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    if (!dbRubrics.length) return;
    const map = Object.fromEntries(dbRubrics.map((r) => [r.competency, r]));
    setForm(
      COMPETENCIES.map((c) => {
        const r = map[c.key];
        return {
          competency: c.key,
          label: c.label,
          target: String(Number(r?.target_score ?? TARGET)),
          weightPct: String(Math.round(Number(r?.weight ?? DEFAULT_WEIGHT) * 100)),
        };
      })
    );
  }, [dbRubrics]);

  const rubricMap = useMemo(
    () => Object.fromEntries(dbRubrics.map((r) => [r.competency, r])),
    [dbRubrics]
  );

  const weightTotal = form.reduce((sum, row) => sum + (Number(row.weightPct) || 0), 0);

  const saveMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        form.map((row) =>
          kpiApi.update(row.competency, {
            target_score: Number(row.target),
            weight: (Number(row.weightPct) || 0) / 100,
          })
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-rubrics'] });
      toast.success('KPI configuration saved.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save KPI configuration.')),
  });

  const resetMutation = useMutation({
    mutationFn: () => kpiApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-rubrics'] });
      toast.success('Reset to platform defaults.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to reset KPI configuration.')),
  });

  function updateRow(competency, patch) {
    setForm((prev) =>
      prev.map((row) => (row.competency === competency ? { ...row, ...patch } : row))
    );
  }

  function applyTemplate(name) {
    const tpl = templates[name];
    if (!tpl) return;
    setForm((prev) =>
      prev.map((row) => {
        const t = tpl[row.competency];
        if (!t) return row;
        return {
          ...row,
          target: String(Number(t.target_score)),
          weightPct: String(Math.round(Number(t.weight) * 100)),
        };
      })
    );
  }

  const rubrics = [
    {
      id: 'task',
      competency: 'task_completion',
      name: '1. Task Completion & Work Output',
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
    <Page
        title="KPI Performance Rubrics"
        subtitle="The 5 Core Competencies & Regularizing Benchmarks · Philippine Labor Code Art. 296"
    >

      {isRubricsError && (
        <div className="p-3 rounded-ctl bg-warn/8 border border-line text-warn text-12 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Could not load your configured targets/weights right now. Showing platform defaults.
          </span>
        </div>
      )}

      {/* Legal Banner */}
        <Card flat padded={false} className="space-y-2">
        <div className="text-accent font-semibold text-12">
          <span className="font-num text-12">
            Statutory Legal Basis (Aliling v. Feliciano / Tamson Doctrine)
          </span>
        </div>
        <p className="text-12 text-ink-2 leading-relaxed">
          In Philippine labor law, reasonable standards of performance must be made known to the employee at the time of engagement (Day 1). Ratings assigned in weekly evaluations directly enforce these communicated criteria.
        </p>
      </Card>

      {/* KPI Configuration — Employer only (Art. 296: targets & weights are employer-configurable) */}
      {canEdit && form.length > 0 && (
        <Card flat padded={false} className="space-y-1">
          <SectionHead
            title="KPI Configuration"
            note={<Badge variant={weightTotal === 100 ? 'ok' : 'warn'}>Weights {weightTotal}%</Badge>}
          />
          <p className="text-12 text-ink-2 leading-relaxed pb-2">
            Set the target and weight for each core competency. Targets are floored at the{' '}
            {TARGET.toFixed(1)} regularizing standard; weights are relative.
          </p>

          <div className="space-y-1">
            {form.map((row) => (
              <div
                key={row.competency}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-line py-2 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_168px_168px]"
              >
                <span className="text-14 text-ink">{row.label}</span>
                <label
                  htmlFor={`target-${row.competency}`}
                  className="flex items-center gap-2 whitespace-nowrap text-12 text-ink-3"
                >
                  Target
                  <input
                    id={`target-${row.competency}`}
                    type="number"
                    inputMode="decimal"
                    min={TARGET}
                    max={TARGET + 1}
                    step={0.1}
                    value={row.target}
                    onChange={(e) => updateRow(row.competency, { target: e.target.value })}
                    className={`${inputClass} w-24`}
                  />
                </label>
                <label
                  htmlFor={`weight-${row.competency}`}
                  className="flex items-center gap-2 whitespace-nowrap text-12 text-ink-3"
                >
                  Weight %
                  <input
                    id={`weight-${row.competency}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={5}
                    value={row.weightPct}
                    onChange={(e) => updateRow(row.competency, { weightPct: e.target.value })}
                    className={`${inputClass} w-24`}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-3 pt-3 border-t border-line">
            <div className="w-full lg:w-64">
              <label htmlFor="kpi-template" className="block text-12 font-medium text-ink-2 mb-1">
                Industry template
              </label>
              <select
                id="kpi-template"
                className={inputClass}
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="">Choose a template…</option>
                {Object.keys(templates).map((key) => (
                  <option key={key} value={key}>
                    {prettyTemplate(key)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              disabled={!selectedTemplate}
              onClick={() => applyTemplate(selectedTemplate)}
            >
              Apply template
            </Button>
            <div className="flex gap-2 lg:ml-auto">
              <Button
                variant="secondary"
                isLoading={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
              >
                Reset to defaults
              </Button>
              <Button
                variant="primary"
                isLoading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save changes
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Rubrics Grid */}
      <div className="space-y-6">
        {rubrics.map((rubric) => (
          <Card padded={false} flat key={rubric.id} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
              <div>
                <h2 className="text-16 font-semibold text-ink">{rubric.name}</h2>
                <p className="text-12 text-ink-3 mt-0.5">{rubric.desc}</p>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-center font-num text-12 text-ink-3">
                <span>
                  Weight:{' '}
                  {rubricMap[rubric.competency]
                    ? `${Math.round(rubricMap[rubric.competency].weight * 100)}%`
                    : '—'}
                </span>
                <span>
                  Target:{' '}
                  {(rubricMap[rubric.competency]?.target_score ?? TARGET).toFixed(1)} / 5.0
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {rubric.levels.map((lvl) => {
                const edge = lvl.title.includes('Target')
                  ? 'border-l-good'
                  : lvl.title.includes('Unsatisfactory')
                  ? 'border-l-bad'
                  : 'border-l-line';
                return (
                  <div key={lvl.score} className={`border-l-2 pl-2.5 ${edge}`}>
                    <span className="block text-12 font-num text-ink-3">{lvl.score}</span>
                    <span className="block text-12 font-semibold text-ink mt-0.5">{lvl.title}</span>
                    <p className="mt-1.5 text-14 text-ink-2 leading-relaxed">{lvl.text}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
