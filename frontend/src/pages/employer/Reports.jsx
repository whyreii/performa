import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useStatusBar } from '../../context/ChromeContext';
import { Button, Badge, Card, Skeleton, EmptyState, Page, inputClass, SectionHead } from '../../components/ui';
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

  useStatusBar(
    `${employees.length} employees · ${REPORT_TYPES.length} report type`,
    'DOLE Article 296 · Asia/Manila'
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
      {/* Generate report */}
      <Card flat padded={false} className="space-y-1">
        <SectionHead title="Generate report" subtitle="DOLE Article 296 · print-ready" />
        <p className="text-12 text-ink-2 leading-relaxed pb-3">
          Opens a print-ready report in a new tab. Use “Save as PDF” to export.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="report-employee" className="flex flex-col gap-1 text-12 text-ink-3">
            Employee
            <select
              id="report-employee"
              className={`${inputClass} min-w-[220px]`}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select an employee…</option>
              {sorted.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.user?.full_name || '—'} · {e.job_title}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="report-type" className="flex flex-col gap-1 text-12 text-ink-3">
            Report type
            <select
              id="report-type"
              className={`${inputClass} min-w-[240px]`}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
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
      <Card flat padded={false} className="space-y-1">
        <SectionHead
          title="Report library"
          subtitle={`${sorted.length} employee${sorted.length === 1 ? '' : 's'}`}
        />
        {isLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center space-y-3">
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
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Employees and their Article 296 reports</caption>
            <thead>
              <tr className="border-b border-line text-12 text-ink-3">
                <th scope="col" className="py-2.5 pr-4 font-normal">Employee</th>
                <th scope="col" className="py-2.5 pr-4 font-normal">Department</th>
                <th scope="col" className="py-2.5 pr-4 font-normal">Status</th>
                <th scope="col" className="py-2.5 text-right font-normal">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td className="py-3 pr-4">
                    <div className="text-14 text-ink font-medium truncate">
                      {e.user?.full_name || '—'}
                    </div>
                    <div className="text-12 text-ink-3 truncate">{e.job_title}</div>
                  </td>
                  <td className="py-3 pr-4 text-14 text-ink-2 truncate">{e.department}</td>
                  <td className="py-3 pr-4">
                    <Badge
                      variant={
                        e.status === 'regularized' ? 'ok' : e.status === 'terminated' ? 'neutral' : 'accent'
                      }
                    >
                      {STATUS_LABEL[e.status] || e.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={Download}
                      isLoading={generatingId === e.id}
                      onClick={() => openReport(e.id)}
                    >
                      Open report
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Page>
  );
}
