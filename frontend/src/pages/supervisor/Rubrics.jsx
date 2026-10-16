import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kpiApi, customKpiApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TARGET, COMPETENCIES, COMPETENCY_DESCRIPTIONS } from '../../config/domain';
import { formatDate } from '../../utils/datetime';
import { AlertCircle } from '../../components/icons';
import { Page, Button, Badge, Label, inputClass, SectionHead } from '../../components/ui';

// Fallback weight used only when the API has not provisioned a tenant default yet.
const DEFAULT_WEIGHT = 0.2;

// The four score bands — defined ONCE. Every competency is read against the same
// bands, so the band header renders a single time above the matrix instead of
// repeating under each competency. Ranges are half-open ("4.0 – <4.6", upper
// bound exclusive) so every 2-decimal overall score lands in exactly one band;
// only the top band includes 5.0. The Proficient floor comes from TARGET
// (config/domain), so the regularizing boundary lives in one place.
const BANDS = [
  { key: 'unsat', range: '1.0 – <3.0', title: 'Unsatisfactory', tone: 'bad' },
  { key: 'dev', range: `3.0 – <${TARGET.toFixed(1)}`, title: 'Developing', tone: 'neutral' },
  { key: 'prof', range: `${TARGET.toFixed(1)} – <4.6`, title: 'Proficient', tone: 'good' },
  { key: 'exemp', range: '4.6 – 5.0', title: 'Exemplary', tone: 'good' },
];

// Level descriptors, keyed by competency and ordered to match BANDS. The
// competency names/descriptions themselves come from config/domain (one source).
const RUBRIC_LEVELS = {
  task_completion: [
    'Consistently misses deadlines; output volume significantly below department baseline.',
    'Meets basic volume requirements; occasionally requires supervisory escalation on complex items.',
    'Consistently completes full work quotas on schedule with minimal oversight.',
    'Exceeds output goals; proactively unblocks team members and streamlines workflows.',
  ],
  quality_of_work: [
    'Frequent errors requiring re-work; fails to follow documented quality checklists.',
    'Acceptable precision on routine tasks; minor oversights on non-routine deliverables.',
    'Deliverables are accurate, thoroughly checked, and comply with all specifications.',
    'Flawless execution; identifies and resolves system errors before they reach stakeholders.',
  ],
  attendance_and_punctuality: [
    'Repeated unexcused tardiness or unscheduled absences; disrupts shift coverage.',
    'Infrequent tardiness; reports unavoidable delays in accordance with policy.',
    'Exemplary attendance record; always ready to start work promptly at scheduled hours.',
    '100% punctuality; flexible to assist in covering emergency team shifts.',
  ],
  communication_and_teamwork: [
    'Displays friction with colleagues; fails to communicate status or blockers.',
    'Communicates clearly on individual tasks; participates adequately in team meetings.',
    'Constructive collaborator; listens actively and resolves issues professionally.',
    'Fosters team morale; bridges communication between departments effectively.',
  ],
  initiative_and_adaptability: [
    'Resistant to feedback; requires constant step-by-step guidance without independent thought.',
    'Accepts coaching willingly; adapts to procedural changes after initial guidance.',
    'Proactive problem solver; applies constructive feedback quickly to improve performance.',
    'Anticipates challenges; introduces novel solutions and mentors peers proactively.',
  ],
};

const TONE_TEXT = { bad: 'text-bad', neutral: 'text-ink-3', good: 'text-good' };

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

  // Audited configuration changes (Employer only).
  const { data: history = [] } = useQuery({
    queryKey: ['kpi-history'],
    queryFn: () => kpiApi.history(),
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
          target: Number(r?.target_score ?? TARGET).toFixed(1),
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

  // "Save changes" is a no-op until something actually differs from the saved rubrics.
  const isDirty = useMemo(() => {
    if (!form.length) return false;
    return form.some((row) => {
      const saved = rubricMap[row.competency];
      const savedTarget = Number(saved?.target_score ?? TARGET);
      const savedWeightPct = Math.round(Number(saved?.weight ?? DEFAULT_WEIGHT) * 100);
      return Number(row.target) !== savedTarget || Number(row.weightPct) !== savedWeightPct;
    });
  }, [form, rubricMap]);

  const saveMutation = useMutation({
    // One atomic request: the server applies the whole set in a single
    // transaction, so a failure never leaves a half-applied configuration.
    mutationFn: () =>
      kpiApi.saveAll(
        form.map((row) => ({
          competency: row.competency,
          target_score: Number(row.target),
          weight: (Number(row.weightPct) || 0) / 100,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-rubrics'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-history'] });
      toast.success('KPI configuration saved.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save KPI configuration.')),
  });

  const resetMutation = useMutation({
    mutationFn: () => kpiApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-rubrics'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-history'] });
      toast.success('Reset to platform defaults.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to reset KPI configuration.')),
  });

  // Employer-defined custom KPIs (non-statutory). The catalog mapping is chosen
  // here and stored, so the intervention set stays deterministic.
  const { data: customKpis = [] } = useQuery({
    queryKey: ['custom-kpis', 'all'],
    queryFn: () => customKpiApi.list({ include_inactive: true }),
    enabled: canEdit,
  });
  const [newKpiName, setNewKpiName] = useState('');
  const [mappedId, setMappedId] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  // Retired KPIs are hidden unless the employer asks to see them.
  const [showRemoved, setShowRemoved] = useState(false);

  const activeKpis = customKpis.filter((kpi) => kpi.is_active);
  const removedKpis = customKpis.filter((kpi) => !kpi.is_active);
  const visibleKpis = showRemoved ? customKpis : activeKpis;

  const suggestMutation = useMutation({
    mutationFn: () => customKpiApi.suggestCourse(newKpiName.trim()),
    onSuccess: (data) => {
      setSuggestion(data);
      setMappedId(data.suggested_catalog_id || '');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to suggest a course.')),
  });

  const createKpiMutation = useMutation({
    mutationFn: () =>
      customKpiApi.create({
        name: newKpiName.trim(),
        mapped_catalog_id: mappedId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kpis'] });
      setNewKpiName('');
      setMappedId('');
      setSuggestion(null);
      toast.success('Custom KPI added.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to add the custom KPI.')),
  });

  const removeKpiMutation = useMutation({
    mutationFn: (id) => customKpiApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kpis'] });
      toast.success('Custom KPI removed.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to remove the custom KPI.')),
  });

  // Removing retires a KPI — it keeps its historical weekly ratings, because
  // deleting evidence is never allowed. Restoring brings the same KPI back, so
  // any employee assignments it had return with it.
  const restoreKpiMutation = useMutation({
    mutationFn: (id) => customKpiApi.update(id, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kpis'] });
      toast.success('Custom KPI restored.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to restore the custom KPI.')),
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
          target: Number(t.target_score).toFixed(1),
          weightPct: String(Math.round(Number(t.weight) * 100)),
        };
      })
    );
  }

  return (
    <Page
      title="KPI Performance Rubrics"
    >
      {isRubricsError && (
        <div className="p-3 rounded-ctl bg-warn/8 border border-line text-warn text-12 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Could not load your configured targets/weights right now. Showing platform defaults.
          </span>
        </div>
      )}

      {/* Statutory basis */}
      <section aria-label="Statutory legal basis">
        <SectionHead title="Statutory legal basis" subtitle="Aliling v. Feliciano / Tamson doctrine" />
        <p className="text-14 text-ink-2 leading-relaxed">
          In Philippine labor law, reasonable standards of performance must be made known to the
          employee at the time of engagement (Day 1). Ratings assigned in weekly evaluations directly
          enforce these communicated criteria.
        </p>
      </section>

      {/* KPI Configuration — Employer only (Art. 296: targets & weights are employer-configurable) */}
      {canEdit && form.length > 0 && (
        <section aria-label="KPI configuration">
          <SectionHead
            title="KPI Configuration"
            subtitle={`Targets floored at the ${TARGET.toFixed(1)} regularizing standard · weights are relative`}
            note={<Badge variant="neutral">Weights {weightTotal}%</Badge>}
          />

          <div>
            {form.map((row) => (
              <div
                key={row.competency}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-line py-2 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_168px_168px]"
              >
                <span className="text-14 text-ink">{row.label}</span>
                <label
                  htmlFor={`target-${row.competency}`}
                  className="flex items-center gap-2 whitespace-nowrap text-14 text-ink-3"
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
                    className={`${inputClass} w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  />
                </label>
                <label
                  htmlFor={`weight-${row.competency}`}
                  className="flex items-center gap-2 whitespace-nowrap text-14 text-ink-3"
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
                    className={`${inputClass} w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-3 pt-3 mt-2 border-t border-line">
            <div className="w-full lg:w-64">
              <Label htmlFor="kpi-template">Industry template</Label>
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
            <div className="flex items-center gap-2 lg:ml-auto">
              {isDirty && <span className="text-12 text-ink-3">Unsaved changes</span>}
              <Button
                variant="secondary"
                isLoading={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
              >
                Reset to defaults
              </Button>
              <Button
                variant="primary"
                disabled={!isDirty}
                isLoading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save changes
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Custom KPIs — employer-defined, non-statutory (Employer only) */}
      {canEdit && (
        <section aria-label="Custom KPIs">
          <SectionHead
            title="Custom KPIs"
            subtitle="Employer-defined criteria outside the 5 statutory competencies"
            note={activeKpis.length ? <Badge variant="neutral">{activeKpis.length}</Badge> : null}
          />
          <p className="text-12 text-ink-3 mb-3 leading-relaxed">
            A custom KPI is rated weekly and never affects the 4.0 standard, the Random Forest model,
            or the competency audit trail. Map it to a catalog course and a monthly average below 3.0
            will raise that course for your approval.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-2">
            <div className="flex-1 min-w-0">
              <Label htmlFor="custom-kpi-name">New custom KPI</Label>
              <input
                id="custom-kpi-name"
                className={inputClass}
                value={newKpiName}
                maxLength={120}
                onChange={(e) => {
                  setNewKpiName(e.target.value);
                  setSuggestion(null);
                }}
                placeholder="Enter a custom KPI name…"
              />
            </div>
            <Button
              variant="secondary"
              className="shrink-0 whitespace-nowrap"
              disabled={!newKpiName.trim()}
              isLoading={suggestMutation.isPending}
              onClick={() => suggestMutation.mutate()}
            >
              Suggest course
            </Button>
            <Button
              variant="primary"
              className="shrink-0 whitespace-nowrap"
              disabled={!newKpiName.trim()}
              isLoading={createKpiMutation.isPending}
              onClick={() => createKpiMutation.mutate()}
            >
              Add KPI
            </Button>
          </div>

          {suggestion && (
            <p className="text-12 text-ink-3 mb-3">
              Suggested course:{' '}
              <span className="text-ink">{suggestion.suggested_title || '—'}</span>
              {suggestion.suggested_catalog_id ? ` (${suggestion.suggested_catalog_id})` : ''}
            </p>
          )}

          {visibleKpis.length === 0 ? (
            <p className="py-3 text-14 text-ink-3">
              {removedKpis.length > 0
                ? 'No active custom KPIs — every one has been removed.'
                : 'No custom KPIs defined yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {visibleKpis.map((kpi) => (
                <li key={kpi.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-14 text-ink break-words">{kpi.name}</div>
                    <div className="text-12 text-ink-3">
                      {kpi.mapped_catalog_id
                        ? `Mapped to catalog course ${kpi.mapped_catalog_id}`
                        : 'No catalog course mapped (summary-only)'}
                      {kpi.is_active ? '' : ' · removed'}
                    </div>
                  </div>
                  {kpi.is_active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={
                        removeKpiMutation.isPending && removeKpiMutation.variables === kpi.id
                      }
                      onClick={() => removeKpiMutation.mutate(kpi.id)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={
                        restoreKpiMutation.isPending && restoreKpiMutation.variables === kpi.id
                      }
                      onClick={() => restoreKpiMutation.mutate(kpi.id)}
                    >
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {removedKpis.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRemoved((shown) => !shown)}
              className="mt-3 text-12 font-semibold text-accent hover:underline"
            >
              {showRemoved ? 'Hide removed' : `Show removed (${removedKpis.length})`}
            </button>
          )}
        </section>
      )}

      {/* Configuration history — every KPI change is audited (Employer only) */}
      {canEdit && (
        <section aria-label="Configuration history">
          <SectionHead
            title="Configuration history"
            subtitle="Recent KPI target & weight changes"
            note={history.length ? <Badge variant="neutral">{history.length}</Badge> : null}
          />
          {history.length === 0 ? (
            <p className="py-3 text-14 text-ink-3">No configuration changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-14 text-ink break-words">
                      {entry.detail || entry.action}
                    </div>
                    <div className="text-12 text-ink-3">
                      {entry.actor_name || 'Unknown'} · {formatDate(entry.created_at, { withTime: true })}
                    </div>
                  </div>
                  <Badge variant="neutral">{entry.action}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Rating rubric — band headers render once; one row per competency */}
      <section aria-label="Rating rubric">
        <SectionHead
          title="Rating rubric"
          subtitle="What each score band means, per competency"
          note={<Badge variant="ok">Target {TARGET.toFixed(1)}</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left align-top">
            <caption className="sr-only">
              Performance rating rubric — five competencies by score band
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="py-2.5 pr-4 font-normal align-bottom"
                  style={{ width: '22%' }}
                >
                  <span className="block text-12 text-ink-3">Competency</span>
                </th>
                {BANDS.map((b) => (
                  <th
                    key={b.key}
                    scope="col"
                    className="py-2.5 pr-4 font-normal align-bottom"
                    style={{ width: '19.5%' }}
                  >
                    <span className={`font-num text-12 ${TONE_TEXT[b.tone]}`}>{b.range}</span>
                    <span className="block text-12 text-ink-2 mt-0.5">{b.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPETENCIES.map((c) => {
                const r = rubricMap[c.key];
                const weight = r ? Math.round(Number(r.weight) * 100) : null;
                const target = Number(r?.target_score ?? TARGET);
                return (
                  <tr key={c.key}>
                    <th scope="row" className="py-3.5 pr-4 align-top text-left">
                      <div className="text-14 font-semibold text-ink">{c.label}</div>
                      <div className="text-12 text-ink-3 mt-0.5 leading-relaxed">
                        {COMPETENCY_DESCRIPTIONS[c.key]}
                      </div>
                      <div className="text-12 text-ink-3 font-num mt-1.5">
                        {weight != null ? `Weight ${weight}% · ` : ''}Target {target.toFixed(1)} / 5.0
                      </div>
                    </th>
                    {RUBRIC_LEVELS[c.key].map((text, i) => (
                      <td
                        key={BANDS[i].key}
                        className="py-3.5 pr-4 align-top text-14 text-ink-2 leading-relaxed"
                      >
                        {text}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
