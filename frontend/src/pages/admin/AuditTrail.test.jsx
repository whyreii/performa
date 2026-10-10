import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import AuditTrail from './AuditTrail';
import { evaluationApi } from '../../api';
import { renderWithProviders } from '../../test/renderWithProviders';
import { auditRows, testUser } from '../../test/apiMock';

vi.mock('../../api', async () => (await import('../../test/apiMock')).createApiMock());

beforeEach(() => localStorage.clear());

describe('AuditTrail', () => {
  it('renders the tenant audit trail rows', async () => {
    evaluationApi.getTenantAuditTrail.mockResolvedValue(auditRows());
    renderWithProviders(<AuditTrail />, { route: '/audits', user: testUser('employer') });
    expect(
      await screen.findByRole('heading', { name: 'Audit Trail & Compliance' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Test Supervisor')).toBeInTheDocument();
  });

  it('shows an error with Retry when the audit fetch fails', async () => {
    evaluationApi.getTenantAuditTrail.mockRejectedValue(new Error('down'));
    renderWithProviders(<AuditTrail />, { route: '/audits', user: testUser('employer') });
    expect(await screen.findByText('Failed to load audit trail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
