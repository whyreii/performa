import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import EmployeeList from '../../components/employees/EmployeeList';
import { Page, EmptyState } from '../../components/ui';
import { Users } from '../../components/icons';

export function EmployeeEmpty() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] px-6">
      <EmptyState icon={Users} title="Select an employee">
        Choose a record from the list to view the scorecard, milestone timeline,
        audit trail, and AI recommendations.
      </EmptyState>
    </div>
  );
}

// Employees split view (master–detail): the record list is always visible; the
// right pane renders the selected employee's detail via the :id route param.
export default function EmployeeSplit() {
  const { id } = useParams();
  return (
    <Page
      title="Employees"
      subtitle="Select a record to view the scorecard, milestone timeline, audit trail, and AI recommendations."
    >
      <div className="split">
        <EmployeeList />
        <div className="split__detail">{id ? <Outlet /> : <EmployeeEmpty />}</div>
      </div>
    </Page>
  );
}
