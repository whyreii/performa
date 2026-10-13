import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, reportApi, getApiErrorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/datetime';
import { Button, Skeleton, EmptyState, Page, SectionHead, Modal, Label, GlideSelect, ConfirmDialog } from '../../components/ui';
import { Download, FileText, Users } from '../../components/icons';

// Article 296 report catalogue. The performance report is the only evidentiary
// export today; the catalogue is shown as the section's report type.
const REPORT_TYPES = [
  { id: 'performance', label: 'Performance Evaluation Report (Article 296)' },
];

// "2048" -> "2.0 KB". Tiny helper for the recorded-report size column.
function formatSize(bytes) {
  const n = Number(bytes) || 0;
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export default function Reports() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const {
    data: reports = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['reports'], queryFn: () => reportApi.list() });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list(),
  });

  const downloadPdf = async (reportId) => {
    try {
      setDownloadingId(reportId);
      const blob = await reportApi.downloadPdf(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'performa-performance-report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download the report.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const generateMutation = useMutation({
    mutationFn: () => reportApi.generate(employeeId),
    onSuccess: async (report) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setIsModalOpen(false);
      toast.success('Report generated and recorded.');
      await downloadPdf(report.id);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to generate the report.')),
  });

  const openGenerate = () => {
    setEmployeeId(employees[0]?.id || '');
    setIsModalOpen(true);
  };

  const removeMutation = useMutation({
    mutationFn: (reportId) => reportApi.remove(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setRemoveTarget(null);
      toast.success('Report removed from the library.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to remove the report.')),
  });

  return (
    <Page
      title="Reports"
      subtitle="DOLE Article 296 performance reports · generate, record and download"
      actions={
        <Button variant="primary" leftIcon={FileText} onClick={openGenerate}>
          Generate report
        </Button>
      }
    >
      <section aria-label="Generated reports">
        <SectionHead
          title="Generated reports"
          subtitle={REPORT_TYPES[0].label}
          note={!isLoading && !isError ? `${reports.length} recorded` : undefined}
        />

        {isLoading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center space-y-3">
            <h3 className="text-14 font-semibold text-ink">Failed to load reports</h3>
            <p className="text-12 text-ink-3">{getApiErrorMessage(error, 'Please retry.')}</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <EmptyState icon={Users} title="No reports generated yet">
            Generate a report for a probationary employee — every generation is recorded here.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Recorded Article 296 reports</caption>
              <thead>
                <tr className="border-b border-line text-12 text-ink-3">
                  <th scope="col" className="py-2.5 pr-4 font-normal">Employee</th>
                  <th scope="col" className="py-2.5 pr-4 font-normal">Generated</th>
                  <th scope="col" className="py-2.5 pr-4 font-normal text-right">Size</th>
                  <th scope="col" className="py-2.5 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4 text-14 text-ink font-medium truncate">
                      {r.employee_name || '—'}
                    </td>
                    <td className="py-3 pr-4 text-14 text-ink-2 font-num whitespace-nowrap">
                      {formatDate(r.created_at, { withTime: true, seconds: false })}
                    </td>
                    <td className="py-3 pr-4 text-14 text-ink-3 font-num text-right whitespace-nowrap">
                      {formatSize(r.size_bytes)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={Download}
                          isLoading={downloadingId === r.id}
                          onClick={() => downloadPdf(r.id)}
                        >
                          PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-bad hover:bg-bad/10"
                          onClick={() => setRemoveTarget(r)}
                        >
                          Remove
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

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeMutation.mutate(removeTarget.id)}
        title="Remove this report?"
        confirmLabel="Remove report"
        variant="danger"
        isLoading={removeMutation.isPending}
      >
        <p>
          Removing the recorded report for{' '}
          <b className="text-ink">{removeTarget?.employee_name || 'this employee'}</b> takes it out
          of the library. The report can be generated again, and the removal is logged.
        </p>
      </ConfirmDialog>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        label="Generate report"
        maxWidth="max-w-md"
      >
        <h3 className="text-16 font-semibold text-ink">Generate performance report</h3>
        <p className="text-12 text-ink-3 mt-1">
          {REPORT_TYPES[0].label} · recorded to the report library and downloaded as PDF.
        </p>

        <div className="mt-4">
          <Label htmlFor="r_emp">Probationary employee</Label>
          <GlideSelect
            id="r_emp"
            className="glide-select--field"
            ariaLabel="Probationary employee"
            value={employeeId}
            onChange={(value) => setEmployeeId(value)}
            options={employees.map((emp) => ({
              value: emp.id,
              label: `${emp.user?.full_name} (${emp.department})`,
            }))}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-line">
          <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIcon={Download}
            disabled={!employeeId}
            isLoading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            Generate &amp; download
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
