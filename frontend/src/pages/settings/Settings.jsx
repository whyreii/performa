import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi, organizationApi, getApiErrorMessage } from '../../api';
import { Button, Badge, TextField, Card, Page } from '../../components/ui';
import {
  Building,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Sun,
  Moon,
  Monitor,
} from '../../components/icons';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { mode, setMode } = useTheme();

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Organization rename state (Admin/Employer only)
  const canManageOrg = user?.role === 'admin' || user?.role === 'employer';
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState(user?.organization_name || '');
  const [orgStatus, setOrgStatus] = useState({ type: '', message: '' });
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    setOrgStatus({ type: '', message: '' });
    if (!orgName.trim()) {
      setOrgStatus({ type: 'error', message: 'Organization name is required.' });
      return;
    }
    setIsSavingOrg(true);
    try {
      await organizationApi.update(orgName.trim());
      await refreshUser();
      setOrgStatus({ type: 'success', message: 'Organization updated successfully.' });
      setIsEditingOrg(false);
    } catch (err) {
      setOrgStatus({
        type: 'error',
        message: getApiErrorMessage(err, 'Failed to update organization.'),
      });
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileStatus({ type: '', message: '' });
    if (!profileName.trim() || !profileEmail.trim()) {
      setProfileStatus({ type: 'error', message: 'Name and email are required.' });
      return;
    }
    setIsSavingProfile(true);
    try {
      await authApi.updateProfile({
        full_name: profileName.trim(),
        email: profileEmail.trim().toLowerCase(),
      });
      await refreshUser();
      setProfileStatus({ type: 'success', message: 'Profile updated successfully.' });
      setIsEditingProfile(false);
    } catch (err) {
      setProfileStatus({
        type: 'error',
        message: getApiErrorMessage(err, 'Failed to update profile.'),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', message: '' });

    if (!currentPassword) {
      setPasswordStatus({ type: 'error', message: 'Current password is required.' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus({
        type: 'error',
        message: 'New password must be at least 8 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'New passwords do not match.',
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordStatus({
        type: 'success',
        message: 'Password updated successfully.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordStatus({
        type: 'error',
        message: getApiErrorMessage(err, 'Failed to update password.'),
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Page
        title="Settings & Appearance"
        subtitle="Configure system appearance, statutory alerts, and account credentials."
    >

      {/* 1. Account Profile Card */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">User Profile & Tenant</h2>
            <p className="text-xs text-ink-3">Your credentials and organization context</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setProfileName(user?.full_name || '');
              setProfileEmail(user?.email || '');
              setProfileStatus({ type: '', message: '' });
              setIsEditingProfile((prev) => !prev);
            }}
          >
            {isEditingProfile ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4 py-3 border-b border-line">
            <span className="text-14 text-ink-3">Full Name</span>
            <span className="text-14 font-semibold text-ink">{user?.full_name || 'User'}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3 border-b border-line">
            <span className="text-14 text-ink-3">Work Email</span>
            <span className="text-14 font-mono text-ink truncate">{user?.email}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3 border-b border-line">
            <span className="text-14 text-ink-3">Platform Role</span>
            <span className="text-14 font-semibold text-accent capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="text-14 text-ink-3">Organization</span>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-14 font-semibold text-ink truncate">
                {user?.organization_name || user?.organization_id || '—'}
              </span>
              {canManageOrg && (
                <button
                  type="button"
                  onClick={() => {
                    setOrgName(user?.organization_name || '');
                    setOrgStatus({ type: '', message: '' });
                    setIsEditingOrg((prev) => !prev);
                  }}
                  className="text-xs text-accent hover:underline shrink-0"
                >
                  {isEditingOrg ? 'Cancel' : 'Rename'}
                </button>
              )}
            </div>
          </div>
        </div>

        {isEditingProfile && (
          <form
            onSubmit={handleProfileSubmit}
            className="mt-5 pt-5 border-t border-line space-y-4 max-w-md"
          >
            {profileStatus.message && (
              <div
                role="alert"
                className={`p-3 rounded-ctl text-xs border border-line ${
                  profileStatus.type === 'error' ? 'bg-bad/8 text-bad' : 'bg-ok/8 text-ok'
                }`}
              >
                {profileStatus.message}
              </div>
            )}
            <TextField
              id="p_name"
              label="Full Name"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <TextField
              id="p_email"
              label="Work Email"
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className="[&_input]:font-mono"
            />
            <Button type="submit" variant="primary" isLoading={isSavingProfile}>
              Save Changes
            </Button>
          </form>
        )}

        {isEditingOrg && (
          <form
            onSubmit={handleOrgSubmit}
            className="mt-5 pt-5 border-t border-line space-y-4 max-w-md"
          >
            {orgStatus.message && (
              <div
                role="alert"
                className={`p-3 rounded-ctl text-xs border border-line ${
                  orgStatus.type === 'error' ? 'bg-bad/8 text-bad' : 'bg-ok/8 text-ok'
                }`}
              >
                {orgStatus.message}
              </div>
            )}
            <TextField
              id="org_name"
              label="Organization Name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <Button type="submit" variant="primary" isLoading={isSavingOrg}>
              Save Organization
            </Button>
          </form>
        )}
      </Card>

      {/* 2. Appearance — Light / Dark / System */}
      <Card>
        <div className="mb-6 pb-4 border-b border-line">
          <h2 className="text-base font-semibold text-ink">Appearance</h2>
          <p className="text-xs text-ink-3">
            Light, Dark, or follow your system. Persisted across sessions.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Color mode"
          className="inline-flex items-center gap-1 p-1 rounded-ctl border border-line bg-hover"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-2 h-9 px-4 rounded-ctl text-sm transition-colors ${
                  isActive
                    ? 'bg-surface text-ink font-semibold border border-line'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4" />
                {m.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Article 296 Statutory Alert Protocols (mandatory, system-dispatched) */}
      <Card>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-line flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Article 296 Statutory Alert Protocols
            </h2>
            <p className="text-xs text-ink-3">
              Mandatory · System Active — dispatched automatically in Asia/Manila against the strict 180-day cap
            </p>
          </div>
          <span className="text-xs font-medium text-ok">System Active</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-4 rounded-ctl bg-hover border border-line">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink">Day 150 Review Due Notice</span>
                <Badge variant="warn">Statutory Milestone</Badge>
              </div>
              <p className="text-xs text-ink-2">
                Triggers when an employee reaches 150 days of probation. Alerts HR and supervisors to schedule the formal 5th-month performance appraisal.
              </p>
            </div>
            <span className="text-xs font-medium text-ok shrink-0 mt-1">Active</span>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-ctl bg-hover border border-line">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink">
                  Day 165 Written Notice Period Threshold
                </span>
                <Badge variant="warn">Legal Due Process</Badge>
              </div>
              <p className="text-xs text-ink-2">
                Guarantees the required 15-day notice buffer before Day 180. Alerts employers if any employee under target is in jeopardy of termination or regularization.
              </p>
            </div>
            <span className="text-xs font-medium text-ok shrink-0 mt-1">Active</span>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-ctl bg-hover border border-line">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink">
                  Day 178 Critical Action Window (48h to Auto-Regularization)
                </span>
                <Badge variant="bad">Critical Threshold</Badge>
              </div>
              <p className="text-xs text-ink-2">
                Final alert: under Philippine law, working on Day 181 confers automatic permanent regular status. Immediate action required.
              </p>
            </div>
            <span className="text-xs font-medium text-ok shrink-0 mt-1">Active</span>
          </div>
        </div>
      </Card>

      {/* 4. Security & Password Update */}
      <Card>
        <div className="mb-6 pb-4 border-b border-line">
          <h2 className="text-base font-semibold text-ink">Security & Password</h2>
          <p className="text-xs text-ink-3">Update your password or manage credentials</p>
        </div>

        {passwordStatus.message && (
          <div
            role="alert"
            className={`mb-5 p-3 rounded-ctl text-xs flex items-center gap-2 border border-line ${
              passwordStatus.type === 'error'
                ? 'bg-bad/8 text-bad'
                : 'bg-ok/8 text-ok'
            }`}
          >
            {passwordStatus.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{passwordStatus.message}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
          <TextField
            id="currPass"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />

          <TextField
            id="newPass"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />

          <TextField
            id="confPass"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" variant="primary" isLoading={isUpdatingPassword} className="mt-2">
            Update Password
          </Button>
        </form>
      </Card>
    </Page>
  );
}
