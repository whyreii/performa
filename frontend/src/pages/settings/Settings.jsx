import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi, getApiErrorMessage } from '../../api';
import { activateOnKey } from '../../utils/a11y';
import { Button, Badge, TextField, Card, PageHeader } from '../../components/ui';
import {
  Building,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { palette, setPalette } = useTheme();

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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

  const palettes = [
    {
      id: 'paper',
      name: 'Paper',
      type: 'Light',
      desc: 'Refined editorial warmth with terracotta rust accents',
      bg: '#f6f3ed',
      accent: '#b94b21',
    },
    {
      id: 'midnight',
      name: 'Midnight',
      type: 'Dark',
      desc: 'Obsidian slate with vibrant electric blue highlights',
      bg: '#090b10',
      accent: '#3b82f6',
    },
    {
      id: 'dusk',
      name: 'Dusk',
      type: 'Dark',
      desc: 'Deep cosmic amethyst with vivid violet tones',
      bg: '#0c0a14',
      accent: '#9368f7',
    },
    {
      id: 'mist',
      name: 'Mist',
      type: 'Light',
      desc: 'Scandinavian technical slate with cool cyan-azure',
      bg: '#f0f4f8',
      accent: '#0274af',
    },
    {
      id: 'sage',
      name: 'Sage',
      type: 'Light',
      desc: 'Organic herbal spruce with deep emerald accents',
      bg: '#edf2ee',
      accent: '#0f766e',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <PageHeader
        title="Settings & Appearance"
        subtitle="Configure system appearance, statutory alerts, and account credentials."
      />

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
            <span className="text-14 font-semibold text-ink truncate">
              {user?.organization_name || user?.organization_id || '—'}
            </span>
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
      </Card>

      {/* 2. Theme & Palette Selection */}
      <Card>
        <div className="mb-6 pb-4 border-b border-line">
          <h2 className="text-base font-semibold text-ink">Design Theme & Palette</h2>
          <p className="text-xs text-ink-3">
            Switch between 5 curated semantic color systems. Persisted across sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {palettes.map((p) => {
            const isSelected = palette === p.id;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setPalette(p.id)}
                onKeyDown={activateOnKey(() => setPalette(p.id))}
                className={`p-4 rounded-ctl border cursor-pointer transition-all duration-performa ${
                  isSelected
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : 'border-ink-3 bg-bg hover:bg-hover hover:border-ink-3'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border border-line ring-1 ring-ink/15 shrink-0 shadow-xs"
                      style={{ backgroundColor: p.bg }}
                    />
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.accent }}
                    />
                    <span className="font-semibold text-sm text-ink">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <span className="text-12 font-semibold text-accent">Active</span>
                    )}
                    <span className="text-12 text-ink-3">{p.type}</span>
                  </div>
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">{p.desc}</p>
              </div>
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
    </div>
  );
}
