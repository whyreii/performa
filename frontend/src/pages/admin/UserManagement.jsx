import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, getApiErrorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/datetime';
import { getInitials } from '../../utils/format';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import TextField from '../../components/ui/TextField';
import Tabs from '../../components/ui/Tabs';
import Page from '../../components/ui/Page';
import { inputClass } from '../../components/ui/Field';
import {
  Users,
  UserPlus,
  KeyRound,
  UserX,
  UserCheck,
  Search,
  Check,
  X,
  AlertCircle,
  Building2,
  Lock,
} from '../../components/icons';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Fetch all users in organization
  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
  });

  // Toggle user status mutation
  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }) => adminApi.updateStatus(userId, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActionFeedback({
        type: 'success',
        message: `Account for ${updated.full_name} is now ${updated.is_active ? 'active' : 'deactivated'}.`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err) => {
      setActionFeedback({
        type: 'error',
        message: getApiErrorMessage(err, 'Failed to update account status.'),
      });
    },
  });

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = selectedRole === 'all' || u.role === selectedRole;
      return matchSearch && matchRole;
    });
  }, [users, searchQuery, selectedRole]);

  // Role counts
  const counts = useMemo(() => {
    return {
      all: users.length,
      employer: users.filter((u) => u.role === 'employer').length,
      supervisor: users.filter((u) => u.role === 'supervisor').length,
      employee: users.filter((u) => u.role === 'probationary_employee').length,
    };
  }, [users]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <Badge variant="hot">Admin</Badge>;
      case 'employer':
        return <Badge variant="accent">Employer</Badge>;
      case 'supervisor':
        return <Badge variant="ok">Supervisor</Badge>;
      case 'probationary_employee':
        return <Badge variant="neutral">Probationary</Badge>;
      default:
        return <Badge variant="neutral">{role}</Badge>;
    }
  };

  return (
    <Page
        kicker="IT & System Administration"
        title="Account Management"
        subtitle={
          <>
            User provisioning, role assignments, and credential management ·{' '}
            <span className="font-mono text-ink">Acme PH</span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={UserPlus} onClick={() => setIsCreateModalOpen(true)}>
            Create User Account
          </Button>
        }
    >

      {/* Action feedback toast */}
      {actionFeedback && (
        <div
          role="alert"
          className={`p-3 rounded-ctl text-xs flex items-center gap-2 border border-line animate-in fade-in duration-150 ${
            actionFeedback.type === 'error' ? 'bg-bad/8 text-bad' : 'bg-ok/8 text-ok'
          }`}
        >
          {actionFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card padded={false} className="p-4 space-y-1">
          <span className="text-xs text-ink-3">Total Accounts</span>
          <div className="text-2xl font-bold font-mono text-ink">{counts.all}</div>
        </Card>
        <Card padded={false} className="p-4 space-y-1">
          <span className="text-xs text-ink-3">Employers</span>
          <div className="text-2xl font-bold font-mono text-accent">{counts.employer}</div>
        </Card>
        <Card padded={false} className="p-4 space-y-1">
          <span className="text-xs text-ink-3">Supervisors</span>
          <div className="text-2xl font-bold font-mono text-good">{counts.supervisor}</div>
        </Card>
        <Card padded={false} className="p-4 space-y-1">
          <span className="text-xs text-ink-3">Probationary Staff</span>
          <div className="text-2xl font-bold font-mono text-ink">{counts.employee}</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Role Filters */}
        <Tabs
          ariaLabel="Filter by role"
          value={selectedRole}
          onChange={setSelectedRole}
          tabs={[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'employer', label: 'Employers', count: counts.employer },
            { id: 'supervisor', label: 'Supervisors', count: counts.supervisor },
            { id: 'probationary_employee', label: 'Probationary', count: counts.employee },
          ]}
        />

        {/* Search Input */}
        <div className="relative w-full sm:w-64 min-w-0">
          <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search users"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {/* Accounts Table */}
      <Card padded={false} className="overflow-hidden">
        {/* Mobile & Tablet stacked cards (< lg) */}
        <div className="lg:hidden divide-y divide-line">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 space-y-3 animate-pulse">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))
          ) : isError ? (
            <div className="p-6 text-center text-bad text-xs">
              {getApiErrorMessage(error, 'Failed to load user accounts.')}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-ink-3 text-xs">
              No accounts found matching your filters.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isCurrent = u.id === currentUser?.id;
              return (
                <div key={u.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 text-accent font-semibold text-xs flex items-center justify-center shrink-0"
                        title={u.full_name}
                      >
                        {getInitials(u.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-ink flex items-center gap-1.5 truncate">
                          <span className="truncate">{u.full_name}</span>
                          {isCurrent && (
                            <span className="font-mono text-12 text-accent font-normal shrink-0">
                              (You)
                            </span>
                          )}
                        </div>
                        <span className="text-12 text-ink-3 font-mono truncate block">
                          {u.email}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getRoleBadge(u.role)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-line/60">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className={u.is_active ? 'text-good' : 'text-ink-3'}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                      <span className="text-ink-3 font-mono text-12 ml-1">
                        · {u.created_at ? formatDate(u.created_at) : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={KeyRound}
                        onClick={() => setResetPasswordUser(u)}
                        className="h-7 px-2 text-12"
                        title="Reset password"
                      >
                        Reset
                      </Button>
                      {!isCurrent && (
                        <Button
                          variant={u.is_active ? 'ghost' : 'secondary'}
                          size="sm"
                          leftIcon={u.is_active ? UserX : UserCheck}
                          onClick={() =>
                            statusMutation.mutate({
                              userId: u.id,
                              isActive: !u.is_active,
                            })
                          }
                          isLoading={statusMutation.isPending}
                          className={`h-7 px-2 text-12 ${
                            u.is_active ? 'text-bad hover:bg-bad/10' : 'text-good hover:bg-good/10'
                          }`}
                          title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: table (>= lg) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">User accounts</caption>
            <thead>
              <tr className="border-b border-line bg-hover/40 text-ink-3 font-mono uppercase text-12 tracking-wider">
                <th scope="col" className="py-3 px-4">User</th>
                <th scope="col" className="py-3 px-4">Role</th>
                <th scope="col" className="py-3 px-4">Status</th>
                <th scope="col" className="py-3 px-4">Created Date</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4 text-right"><Skeleton className="h-7 w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-bad">
                    {getApiErrorMessage(error, 'Failed to load user accounts.')}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-ink-3">
                    No accounts found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-hover/50 transition-colors"
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 text-accent font-semibold text-xs flex items-center justify-center shrink-0"
                            title={u.full_name}
                          >
                            {getInitials(u.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-ink flex items-center gap-1.5">
                              <span className="truncate">{u.full_name}</span>
                              {isCurrent && (
                                <span className="font-mono text-12 text-accent font-normal">
                                  (You)
                                </span>
                              )}
                            </div>
                            <span className="text-12 text-ink-3 font-mono truncate block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* Active Status */}
                      <td className="py-3 px-4">
                        <span className={`font-medium ${u.is_active ? 'text-good' : 'text-ink-3'}`}>
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-ink-3 font-mono text-12">
                        {u.created_at ? formatDate(u.created_at) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={KeyRound}
                            onClick={() => setResetPasswordUser(u)}
                            className="h-7 px-2 text-12"
                            title="Reset password"
                          >
                            Reset
                          </Button>

                          {!isCurrent && (
                            <Button
                              variant={u.is_active ? 'ghost' : 'secondary'}
                              size="sm"
                              leftIcon={u.is_active ? UserX : UserCheck}
                              onClick={() =>
                                statusMutation.mutate({
                                  userId: u.id,
                                  isActive: !u.is_active,
                                })
                              }
                              isLoading={statusMutation.isPending}
                              className={`h-7 px-2 text-12 ${
                                u.is_active ? 'text-bad hover:bg-bad/10' : 'text-good hover:bg-good/10'
                              }`}
                              title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                            >
                              {u.is_active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal 1: Create User Account */}
      {isCreateModalOpen && (
        <CreateUserModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newUser) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setIsCreateModalOpen(false);
            setActionFeedback({
              type: 'success',
              message: `Created ${newUser.role} account for ${newUser.full_name} (${newUser.email}).`,
            });
            setTimeout(() => setActionFeedback(null), 5000);
          }}
        />
      )}

      {/* Modal 2: Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => {
            setResetPasswordUser(null);
            setActionFeedback({
              type: 'success',
              message: `Password reset successfully for ${resetPasswordUser.email}.`,
            });
            setTimeout(() => setActionFeedback(null), 4000);
          }}
        />
      )}
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Create User Modal Component
// -----------------------------------------------------------------------------
function CreateUserModal({ onClose, onSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employer');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const newUser = await adminApi.createUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      onSuccess(newUser);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create user account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} labelledBy="create-user-title" maxWidth="max-w-md">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 id="create-user-title" className="text-base font-semibold text-ink">Create User Account</h2>
            <p className="text-xs text-ink-3">Provision credentials and assign system role</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-ctl bg-bad/8 border border-line text-bad text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <TextField
            id="m_name"
            label="Full Name *"
            type="text"
            required
            placeholder="e.g. Maria Santos"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <TextField
            id="m_email"
            label="Work Email Address *"
            type="email"
            required
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="[&_input]:font-mono"
          />

          <TextField
            id="m_pass"
            label="Initial Password * (min 8 characters)"
            type="password"
            required
            minLength={8}
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="[&_input]:font-mono"
          />

          <div>
            <div id="role-group-label" className="block text-ink-2 font-medium mb-1.5">
              Assigned System Role *
            </div>
            <div
              role="radiogroup"
              aria-labelledby="role-group-label"
              className="grid grid-cols-3 gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={role === 'employer'}
                onClick={() => setRole('employer')}
                className={`p-3 rounded-ctl border text-center transition-all ${
                  role === 'employer'
                    ? 'border-accent bg-accent/8 text-accent font-semibold shadow-xs'
                    : 'border-line text-ink-2 hover:bg-hover'
                }`}
              >
                <div className="font-semibold">Employer</div>
                <div className="text-12 text-ink-3 mt-0.5">Business Owner</div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={role === 'supervisor'}
                onClick={() => setRole('supervisor')}
                className={`p-3 rounded-ctl border text-center transition-all ${
                  role === 'supervisor'
                    ? 'border-good bg-good/8 text-good font-semibold shadow-xs'
                    : 'border-line text-ink-2 hover:bg-hover'
                }`}
              >
                <div className="font-semibold">Supervisor</div>
                <div className="text-12 text-ink-3 mt-0.5">Rating Evaluator</div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={role === 'probationary_employee'}
                onClick={() => setRole('probationary_employee')}
                className={`p-3 rounded-ctl border text-center transition-all ${
                  role === 'probationary_employee'
                    ? 'border-ink text-ink font-semibold bg-hover shadow-xs'
                    : 'border-line text-ink-2 hover:bg-hover'
                }`}
              >
                <div className="font-semibold">Employee</div>
                <div className="text-12 text-ink-3 mt-0.5">Probationary Staff</div>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Reset Password Modal Component
// -----------------------------------------------------------------------------
function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await adminApi.resetPassword(user.id, password);
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} labelledBy="reset-pass-title" maxWidth="max-w-sm">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h2 id="reset-pass-title" className="text-base font-semibold text-ink">Reset Password</h2>
            <p className="text-xs text-ink-3 font-mono truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-ctl bg-bad/8 border border-line text-bad text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <TextField
            id="r_pass"
            label="New Password * (min 8 characters)"
            type="password"
            required
            minLength={8}
            placeholder="Enter new secure password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="[&_input]:font-mono"
          />

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Update Password
            </Button>
          </div>
        </form>
    </Modal>
  );
}
