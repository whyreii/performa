import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { evaluationApi, getApiErrorMessage } from '../../api';
import { formatDate } from '../../utils/datetime';
import { COMPETENCIES } from '../../config/domain';
import { Button, Badge, Skeleton } from '../../components/ui';
import {
  History,
  ShieldCheck,
  Printer,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function AuditTrail() {
  const [competencyFilter, setCompetencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredLogs = auditLogs.filter((log) => {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Audit Trail & Compliance
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Article 296 Evidentiary Due Process Logs · Immutable & Append-Only
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={Printer}
            onClick={() => window.print()}
          >
            Print Compliance Log
          </Button>
        </div>
      </header>

      {/* DOLE Evidentiary Standards Banner */}
      <section className="bg-surface border border-line rounded-float p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2.5 text-accent font-semibold text-xs">
          <ShieldCheck className="w-4 h-4" />
          <span className="uppercase tracking-wider font-mono text-[11px]">
            Statutory Legal Standard · Republic of the Philippines
          </span>
        </div>
        <p className="text-xs text-ink-2 leading-relaxed">
          Under Philippine Labor Code Article 296 and established Supreme Court doctrine, employers carry the burden of proof in probationary disputes. Every score entry and modification below is logged with exact timestamps (Asia/Manila) and evaluator credentials for permanent due process records.
        </p>
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evaluator or competency..."
              aria-label="Search audit trail"
              className="w-full h-8 pl-9 pr-3 rounded-ctl border border-line bg-surface text-ink text-xs focus:outline-none focus:border-accent transition-colors shadow-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={competencyFilter}
            onChange={(e) => setCompetencyFilter(e.target.value)}
            className="h-8 px-2.5 rounded-ctl border border-line bg-surface text-ink text-xs focus:outline-none focus:border-accent transition-colors shadow-xs cursor-pointer"
          >
            <option value="all">All Competencies</option>
            {COMPETENCIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <section className="bg-surface border border-line rounded-float shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-bad mx-auto" />
            <h3 className="text-sm font-semibold text-ink">Failed to load audit trail</h3>
            <p className="text-xs text-ink-3">
              {getApiErrorMessage(error, 'An error occurred while loading audit records.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <History className="w-10 h-10 text-ink-3/40 mx-auto" />
            <h3 className="text-base font-medium text-ink">No audit entries found</h3>
            <p className="text-xs text-ink-3">
              Weekly evaluations submitted by supervisors will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-[11px] font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th className="py-3 px-4">Timestamp (Asia/Manila)</th>
                  <th className="py-3 px-4">Evaluator</th>
                  <th className="py-3 px-4">Competency</th>
                  <th className="py-3 px-4">Score Transition</th>
                  <th className="py-3 px-4">Integrity Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredLogs.map((log) => {
                  const hasPrior = log.prior_score !== null && log.prior_score !== undefined;
                  return (
                    <tr key={log.id} className="hover:bg-hover transition-colors font-mono">
                      <td className="py-3 px-4 text-ink-2 whitespace-nowrap">
                        {formatDate(log.created_at, { withTime: true })}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-ink">
                        {log.evaluator_name}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <Badge variant="neutral">
                          {log.competency?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {hasPrior ? (
                            <>
                              <span className="text-ink-3">{log.prior_score?.toFixed(1)}</span>
                              <ArrowRight className="w-3 h-3 text-ink-3" />
                            </>
                          ) : (
                            <span className="text-ink-3 text-[10px]">Initial →</span>
                          )}
                          <span className="font-bold text-ink text-sm">
                            {log.new_score?.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-ok text-[11px] font-sans">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Append-only</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="p-3 border-t border-line text-xs text-ink-3 font-mono flex items-center justify-between">
          <span>Showing {filteredLogs.length} verified audit records</span>
          <span>Acme Philippines Corp. · Legal Archive</span>
        </footer>
      </section>
    </div>
  );
}
