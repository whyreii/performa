import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { evaluationApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/datetime';
import { COMPETENCIES } from '../../config/domain';
import { Button, Badge, Skeleton, EmptyState, Card, Page, inputClass, GlideSelect, Th, SectionHead } from '../../components/ui';
import {
  History,
  Printer,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
} from '../../components/icons';

const COMPETENCY_LABELS = new Map(COMPETENCIES.map((c) => [c.key, c.label]));

function competencyLabel(key) {
  return COMPETENCY_LABELS.get(key) || (key ? key.replace(/_/g, ' ') : '');
}

export default function AuditTrail() {
  const { user } = useAuth();
  const orgLabel = user?.organization_name || user?.organization_id || 'Organization';
  const [competencyFilter, setCompetencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('ts');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const {
    data: auditLogs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tenant-audit-trail'],
    queryFn: () => evaluationApi.getTenantAuditTrail(),
  });

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ts' ? 'desc' : 'asc');
    }
  };

  const sortedLogs = useMemo(() => {
    const filtered = auditLogs.filter((log) => {
      if (competencyFilter !== 'all' && log.competency !== competencyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const evaluator = (log.evaluator_name || '').toLowerCase();
        const comp = (log.competency || '').toLowerCase();
        const id = (log.id || '').toLowerCase();
        if (!evaluator.includes(q) && !comp.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
    const valueOf = (log) => {
      if (sortKey === 'evaluator') return (log.evaluator_name || '').toLowerCase();
      if (sortKey === 'competency') return (log.competency || '').toLowerCase();
      if (sortKey === 'change') return Number(log.new_score) || 0;
      return log.created_at || '';
    };
    return [...filtered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? r : -r;
    });
  }, [auditLogs, competencyFilter, searchQuery, sortKey, sortDir]);

  // Reset to the first page whenever the filters or sort change.
  useEffect(() => {
    setPage(1);
  }, [competencyFilter, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLogs = sortedLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <Page
        aboveHeader={
          <div hidden className="print-only mb-6 pb-4 border-b-2 border-black text-black">
            <div className="text-center space-y-1">
              <p className="text-12 uppercase tracking-widest font-semibold">Republic of the Philippines</p>
              <p className="text-12 font-semibold">DEPARTMENT OF LABOR AND EMPLOYMENT</p>
              <p className="text-16 font-bold uppercase tracking-tight mt-1">
                Article 296 Statutory Evaluation Audit Exhibit
              </p>
              <p className="text-12 text-gray-600">
                Tenant: {orgLabel} · Generated: {formatDate(new Date())} (Asia/Manila)
              </p>
            </div>
          </div>
        }
        headerClassName="no-print"
        title="Audit Trail & Compliance"
        subtitle="Article 296 Evidentiary Due Process Logs · Immutable & Append-Only"
        actions={
          <Button variant="secondary" leftIcon={Printer} onClick={() => window.print()}>
            Print Compliance Log
          </Button>
        }
    >

      {/* DOLE Evidentiary Standards Banner */}
      <Card flat padded={false} className="space-y-2 no-print">
        <SectionHead
          title="Statutory Legal Standard · Republic of the Philippines"
          subtitle="Article 296 · immutable"
        />
        <p className="text-12 text-ink-2 leading-relaxed">
          Under Philippine Labor Code Article 296 and established Supreme Court doctrine, employers carry the burden of proof in probationary disputes. Every score entry and modification below is logged with exact timestamps (Asia/Manila) and evaluator credentials for permanent due process records.
        </p>
      </Card>

      {/* Audit log */}
      <SectionHead
        title="Audit log"
        subtitle={`${sortedLogs.length} append-only records`}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evaluator or competency…"
              aria-label="Search audit trail"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <GlideSelect
          className="glide-select--control"
          ariaLabel="Filter by competency"
          value={competencyFilter}
          onChange={(value) => setCompetencyFilter(value)}
          options={[
            { value: 'all', label: 'All Competencies' },
            ...COMPETENCIES.map((c) => ({ value: c.key, label: c.label })),
          ]}
          showTags={false}
          accentColor="var(--accent)"
          surfaceColor="var(--surface)"
          highlightColor="var(--hover)"
          textColor="var(--ink)"
          size="md"
          radius={8}
          menuWidth={248}
        />
      </div>

      {/* Audit Log Table */}
      <Card flat padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-14 font-semibold text-ink">Failed to load audit trail</h3>
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(error, 'An error occurred while loading audit records.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : sortedLogs.length === 0 ? (
          <EmptyState icon={History} title="No audit entries found">
            Weekly evaluations submitted by supervisors will appear here automatically.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">
                Evidentiary labor score audit trail (Article 296)
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <Th sortKey="ts" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    When (Asia/Manila)
                  </Th>
                  <Th sortKey="evaluator" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    Evaluator
                  </Th>
                  <Th sortKey="competency" activeKey={sortKey} dir={sortDir} onSort={onSort} className="py-2.5 px-4">
                    Competency
                  </Th>
                  <Th sortKey="change" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="py-2.5 px-4">
                    Change
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageLogs.map((log) => {
                  const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
                  return (
                    <tr key={log.id} className="hover:bg-hover transition-colors">
                      <td className="py-3 px-4 font-num text-12 text-ink-3 whitespace-nowrap">
                        {formatDate(log.created_at, { withTime: true })}
                      </td>
                      <td className="py-3 px-4 text-14 font-medium text-ink">
                        {log.evaluator_name}
                      </td>
                      <td className="py-3 px-4 text-14 text-ink-2">
                        {competencyLabel(log.competency)}
                      </td>
                      <td className="py-3 px-4 text-right font-num text-14 whitespace-nowrap">
                        <span className="text-ink-3">
                          {hasPrior ? `${log.prior_score?.toFixed(1)} → ` : 'Initial → '}
                        </span>
                        <span className="font-bold text-ink">
                          {log.new_score?.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="p-3 border-t border-line text-12 text-ink-3 font-num flex flex-wrap items-center justify-between gap-2 no-print">
          <span>
            Showing {sortedLogs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, sortedLogs.length)} of {sortedLogs.length} append-only audit records
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
            <span className="hidden sm:inline">{orgLabel} · Legal Archive</span>
        </footer>
      </Card>

      {/* Print-Only Official Certification & Signatures */}
      <div className="print-only mt-8 pt-6 border-t-2 border-black text-black space-y-6">
        <p className="text-12 italic leading-relaxed text-gray-700">
          Official Attestation: This evidentiary exhibit is generated directly from the immutable, append-only
          audit log of the Performa platform pursuant to Article 296 of the Philippine Labor Code.
          Every weekly competency rating, score delta, and rater identity is permanently preserved for DOLE/NLRC
          compliance verification.
        </p>

        <div className="grid grid-cols-3 gap-8 pt-6 text-center text-12">
          <div>
            <div className="border-b border-black mb-1 w-full h-10" />
            <p className="font-semibold text-12">Evaluator Signature</p>
            <p className="text-12 text-gray-600">Supervisor / Designated Rater</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 w-full h-10" />
            <p className="font-semibold text-12">Employee Acknowledgment</p>
            <p className="text-12 text-gray-600">Probationary Staff</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 w-full h-10" />
            <p className="font-semibold text-12">Employer / HR Attestation</p>
            <p className="text-12 text-gray-600">Managing Authority</p>
          </div>
        </div>
      </div>
    </Page>
  );
}
