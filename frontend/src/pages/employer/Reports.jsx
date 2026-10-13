import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeeApi, evaluationApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Skeleton, EmptyState, Page, SectionHead, Th } from '../../components/ui';
import { Download, FileText, Users } from '../../components/icons';

// Article 296 report catalogue. The performance report is the only evidentiary
// export today; the catalogue is shown as the section's report type.
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
  const [generatingId, setGeneratingId] = useState(null);
  const [pdfId, setPdfId] = useState(null);

  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['employees'], queryFn: () => employeeApi.list() });

  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const onSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const sorted = useMemo(() => {
    const list = [...employees];
    const keyOf = (e) => {
      switch (sort.key) {
        case 'department':
          return (e.department || '').toLowerCase();
        case 'status':
          return (e.status || '').toLowerCase();
        default:
          return (e.user?.full_name || '').toLowerCase();
      }
    };
    list.sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      const r = ka < kb ? -1 : ka > kb ? 1 : 0;
      return sort.dir === 'asc' ? r : -r;
    });
    return list;
  }, [employees, sort]);

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

  const downloadPdf = async (id) => {
    if (!id) return;
    try {
      setPdfId(id);
      const blob = await evaluationApi.getReportPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'performa-performance-report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('PDF report downloaded.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to generate the PDF report.'));
    } finally {
      setPdfId(null);
    }
  };

  return (
    <Page title="Reports" subtitle="DOLE Article 296 performance reports · print-ready">
      <section aria-label="Performance reports">
        <SectionHead
          title="Performance reports"
          subtitle={REPORT_TYPES[0].label}
          note={
            !isLoading && !isError
              ? `${sorted.length} employee${sorted.length === 1 ? '' : 's'}`
              : undefined
          }
        />
        <p className="text-14 text-ink-2 leading-relaxed mb-3">
          Open a print-ready report in a new tab, then use “Save as PDF” to export it.
        </p>

        {isLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center space-y-3">
            <h3 className="text-14 font-semibold text-ink">Failed to load employees</h3>
            <p className="text-12 text-ink-3">
              {getApiErrorMessage(error, 'Please retry.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={Users} title="No employees yet">
            Onboard a probationary employee to generate reports.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Employees and their Article 296 reports</caption>
              <thead>
                <tr className="border-b border-line text-12 text-ink-3">
                  <Th sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={onSort} className="py-2.5 pr-4">
                    Employee
                  </Th>
                  <Th sortKey="department" activeKey={sort.key} dir={sort.dir} onSort={onSort} className="py-2.5 pr-4">
                    Department
                  </Th>
                  <Th sortKey="status" activeKey={sort.key} dir={sort.dir} onSort={onSort} className="py-2.5 pr-4">
                    Status
                  </Th>
                  <th scope="col" className="py-2.5 text-right font-normal">
                    Report
                  </th>
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
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={FileText}
                          isLoading={generatingId === e.id}
                          onClick={() => openReport(e.id)}
                        >
                          Open report
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Download}
                          isLoading={pdfId === e.id}
                          onClick={() => downloadPdf(e.id)}
                        >
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  );
}
