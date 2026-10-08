import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Page } from '../components/ui';

const ROLE_HOME = {
  admin: '/admin/users',
  employer: '/dashboard',
  supervisor: '/supervisor/dashboard',
  probationary_employee: '/employee/dashboard',
};

// Unknown-route page (WCAG 2.4.2 title set in App). Renders through <Page> per
// the design-system guardrail; it has no shell, so it centres its own content.
export default function NotFound() {
  const { user, isAuthenticated } = useAuth();
  const home = isAuthenticated ? ROLE_HOME[user?.role] || '/login' : '/login';

  return (
    <Page header={false}>
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-3">
          <p className="font-num text-30 font-semibold text-ink-3">404</p>
          <h1 className="text-22 font-semibold text-ink">Page not found</h1>
          <p className="text-14 text-ink-2">
            The page you requested does not exist or has moved.
          </p>
          <Link
            to={home}
            className="inline-flex items-center justify-center h-9 px-4 rounded-ctl bg-accent text-accent-foreground text-14 font-medium hover:brightness-110 transition-colors"
          >
            {isAuthenticated ? 'Go to my dashboard' : 'Sign in'}
          </Link>
        </div>
      </div>
    </Page>
  );
}
