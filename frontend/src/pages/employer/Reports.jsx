import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Card, Skeleton, EmptyState, Page, inputClass } from '../../components/ui';
import { FileText, Download, Users } from '../../components/icons';

// Article 296 report catalogue. The performance report is the only evidentiary
// export today; the selector keeps the manuscript's "report type" affordance.
const REPORT_TYPES = [
  { id: 'performance', label: 'Performance Evaluation Report (Article 296)' },
];

const STATUS_LABEL = {
  active: 'Active',
  regularized: 'Regularized',
  terminated: 'Terminated',
};

export default function Reports() {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [reportType, setReportType] = useState(REPORT_TYPES[0].id);
  const [generatingId, setGeneratingId] = useState(null);

  const {
    data: employees = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['employees'], queryFn: () => employeeApi.list() });

  const sorted = useMemo(
    () => [...employees].sort((a, b) => (a.user?.full_name || '').localeCompare(b.user?.full_name || '')),
    [employees]
  );

  const openReport = async (id) => {
    if (!id) return;
    try {
      setGeneratingId(id);
      const reportHtml = await evaluationApi.getReportHtml(id);
      const blob = new Blob([reportHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'performa-performance-report.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('Report generated. Use your browser to print or Save as PDF.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to generate the report.'));
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <Page
      title="Reports"
      subtitle="Generate DOLE Article 296 performance reports per employee"
    >
      {/* Generator */}
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="report-employee" className="block text-12 font-medium text-ink-2 mb-1">
              Employee
            </label>
            <select
              id="report-employee"
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select an employee…</option>
              {sorted.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.user?.full_name || 'Unknown')} — {e.job_title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-type" className="block text-12 font-medium text-ink-2 mb-1">
              Report type
            </label>
            <select
              id="report-type"
              className={inputClass}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-line">
          <p className="text-12 text-ink-3">
            Opens a print-ready report in a new tab — use “Save as PDF” to export.
          </p>
          <Button
            variant="primary"
            leftIcon={FileText}
            disabled={!employeeId}
            isLoading={generatingId === employeeId && !!employeeId}
            onClick={() => openReport(employeeId)}
          >
            Generate Report
          </Button>
        </div>
      </Card>

      {/* Report library */}
      <Card padded={false} className="divide-y divide-line">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <h3 className="text-14 font-semibold text-ink">Failed to load employees</h3>
            <p className="text-12 text-ink-3">{getApiErrorMessage(undefined, 'Please retry.')}</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={Users} title="No employees yet">
            Onboard a probationary employee to generate reports.
          </EmptyState>
        ) : (
          sorted.map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-14 text-ink font-medium truncate">
                  {e.user?.full_name || 'Unknown employee'}
                </div>
                <div className="text-12 text-ink-3 truncate">
                  {e.job_title} · {e.department}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge
                  variant={
                    e.status === 'regularized' ? 'ok' : e.status === 'terminated' ? 'neutral' : 'accent'
                  }
                >
                  {STATUS_LABEL[e.status] || e.status}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={Download}
                  isLoading={generatingId === e.id}
                  onClick={() => openReport(e.id)}
                >
                  Open report
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </Page>
  );
}
