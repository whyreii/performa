import React from 'react';
import EmployeeList from '../../components/employees/EmployeeList';
import { Page } from '../../components/ui';

// Employees directory — the record list. Its minimal hero is the page top
// (docs/LAYOUT_GRAMMAR.md), so the Page wrapper renders no header.
export default function EmployeeSplit() {
  return (
    <Page header={false}>
      <EmployeeList />
    </Page>
  );
}
