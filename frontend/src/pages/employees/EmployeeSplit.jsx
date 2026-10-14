import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import EmployeeList from '../../components/employees/EmployeeList';
import AddEmployeeModal from '../../components/employees/AddEmployeeModal';
import { Page, Button } from '../../components/ui';
import { Plus } from '../../components/icons';

// Employees directory — a full-width searchable/filterable table, consistent
// with the employer dashboard worklist. Selecting a row opens the record at
// /employees/:id as a full page (no master–detail split).
export default function EmployeeSplit() {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const canOnboard = user?.role === 'employer';

  return (
    <Page
      title="Employees"
      actions={
        canOnboard ? (
          <Button variant="primary" leftIcon={Plus} onClick={() => setIsAddOpen(true)}>
            Add employee
          </Button>
        ) : null
      }
    >
      <EmployeeList />
      {canOnboard && (
        <AddEmployeeModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      )}
    </Page>
  );
}
