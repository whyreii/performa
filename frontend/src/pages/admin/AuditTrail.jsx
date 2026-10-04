import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { evaluationApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/datetime';
import { COMPETENCIES } from '../../config/domain';
import { Button, Badge, Skeleton, EmptyState, Card, PageHeader } from '../../components/ui';
import {
  History,
  Printer,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function AuditTrail() {
  const { user } = useAuth();
  const orgLabel = user?.organization_name || user?.organization_id || 'Organization';
  const [competencyFilter, setCompetencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [competencyFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Print-Only Official DOLE Exhibit Header */}
      <div hidden className="print-only mb-6 pb-4 border-b-2 border-black text-black">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest font-semibold">Republic of the Philippines</p>
          <p className="text-xs font-semibold">DEPARTMENT OF LABOR AND EMPLOYMENT</p>
          <h1 className="text-base font-bold uppercase tracking-tight mt-1">
            Article 296 Statutory Evaluation Audit Exhibit
          </h1>
          <p className="text-12 text-gray-600">
            Tenant: {orgLabel} · Generated: {formatDate(new Date())} (Asia/Manila)
          </p>
        </div>
      </div>

      <PageHeader
        className="no-print"
        title="Audit Trail & Compliance"
        subtitle="Article 296 Evidentiary Due Process Logs · Immutable & Append-Only"
        actions={
          <Button variant="secondary" leftIcon={Printer} onClick={() => window.print()}>
            Print Compliance Log
          </Button>
        }
      />

      {/* DOLE Evidentiary Standards Banner */}
      <Card padded={false} className="p-5 space-y-2 no-print">
        <div className="text-accent font-semibold text-xs">
          <span className="font-mono text-12">
            Statutory Legal Standard · Republic of the Philippines
          </span>
        </div>
        <p className="text-xs text-ink-2 leading-relaxed">
          Under Philippine Labor Code Article 296 and established Supreme Court doctrine, employers carry the burden of proof in probationary disputes. Every score entry and modification below is logged with exact timestamps (Asia/Manila) and evaluator credentials for permanent due process records.
        </p>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
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
            aria-label="Filter by competency"
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
      <Card padded={false} className="overflow-hidden">
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
          <EmptyState icon={History} title="No audit entries found">
            Weekly evaluations submitted by supervisors will appear here automatically.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <caption className="sr-only">
                Evidentiary labor score audit trail (Article 296)
              </caption>
              <thead>
                <tr className="border-b border-line text-12 font-medium text-ink-3 uppercase tracking-wider bg-hover/40">
                  <th scope="col" className="py-3 px-4">Timestamp (Asia/Manila)</th>
                  <th scope="col" className="py-3 px-4">Evaluator</th>
                  <th scope="col" className="py-3 px-4">Competency</th>
                  <th scope="col" className="py-3 px-4">Score Transition</th>
                  <th scope="col" className="py-3 px-4">Integrity Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageLogs.map((log) => {
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
                        <Badge variant="neutral" className="capitalize">
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
                            <span className="text-ink-3 text-12">Initial -&gt;</span>
                          )}
                          <span className="font-bold text-ink text-sm">
                            {log.new_score?.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-ok text-12">Append-only</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="p-3 border-t border-line text-xs text-ink-3 font-mono flex flex-wrap items-center justify-between gap-2 no-print">
          <span>
            Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} verified audit records
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
          audit log of the Performa Capstone Platform pursuant to Article 296 of the Philippine Labor Code.
          Every weekly competency rating, score delta, and rater identity is permanently preserved for DOLE/NLRC
          compliance verification.
        </p>

        <div className="grid grid-cols-3 gap-8 pt-6 text-center text-xs">
          <div>
            <div className="border-b border-black mb-1 w-full h-10" />
            <p className="font-semibold text-xs">Evaluator Signature</p>
            <p className="text-12 text-gray-600">Supervisor / Designated Rater</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 w-full h-10" />
            <p className="font-semibold text-xs">Employee Acknowledgment</p>
            <p className="text-12 text-gray-600">Probationary Staff</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 w-full h-10" />
            <p className="font-semibold text-xs">Employer / HR Attestation</p>
            <p className="text-12 text-gray-600">Managing Authority</p>
          </div>
        </div>
      </div>
    </div>
  );
}
