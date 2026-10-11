import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi, adminApi, organizationApi, getApiErrorMessage } from '../../api';
import { COMPETENCIES } from '../../config/domain';
import { Button, Badge, TextField, Page, RubberSegment } from '../../components/ui';
import {
  User,
  Palette,
  AlertTriangle,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
} from '../../components/icons';

// Statutory milestone day labels + competency/industry display helpers.
const THRESHOLD_LABELS = {
  day_150: 'Day 150 · Performance review',
  day_165: 'Day 165 · Written-notice window',
  day_178: 'Day 178 · Critical action window',
  day_180: 'Day 180 · Legal ceiling',
};
const COMPETENCY_LABELS = new Map(COMPETENCIES.map((c) => [c.key, c.label]));
const prettyKey = (key) =>
  key
    .split('_')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

// Rail sections. Hash-addressable so a section can be linked to directly.
const SECTIONS = [
  { id: 'profile', label: 'Profile & tenant', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'alerts', label: 'Statutory alerts', icon: AlertTriangle },
  { id: 'security', label: 'Security', icon: Lock },
];

const sectionFromHash = () => {
  const h = window.location.hash.replace('#', '');
  return SECTIONS.some((s) => s.id === h) ? h : 'profile';
};

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { mode, setMode, reduceMotion, setReduceMotion } = useTheme();

  // Active rail section (deep-linkable via #profile / #appearance / …).
  const [active, setActive] = useState(sectionFromHash);

  useEffect(() => {
    const onHash = () => setActive(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectSection = (id) => {
    setActive(id);
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', `#${id}`);
    } else {
      window.location.hash = id;
    }
  };

  // Administrators get an extra read-only "System settings" section (Manuscript
  // Scope: global deadline thresholds + industry KPI template library). The rest
  // of the roles never see it, and a stale #system hash falls back to Profile.
  const isAdmin = user?.role === 'admin';
  const sections = isAdmin
    ? [...SECTIONS, { id: 'system', label: 'System settings', icon: ShieldCheck }]
    : SECTIONS;
  const current = sections.some((s) => s.id === active) ? active : 'profile';

  const { data: systemSettings, isError: isSystemError } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings(),
    enabled: isAdmin,
  });

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
      <div className="srail">
        {/* Rail */}
        <nav className="srail__nav" aria-label="Settings sections">
          <div className="srail__t">Settings</div>
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = current === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSection(s.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`srail__b${isActive ? ' is-active' : ''}`}
              >
                <Icon className="srail__ico" weight={isActive ? 'fill' : 'regular'} />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Reading column */}
        <div className="srail__pane">
          <div className="srail__inner">
            {current === 'profile' && (
              <section className="ssec">
                <div className="ssec__h">
                  <div>
                    <h2>User Profile &amp; Tenant</h2>
                    <p>Your credentials and organization context</p>
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
                    <span className="text-14 font-num text-ink truncate">{user?.email}</span>
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
                          className="text-12 text-accent hover:underline shrink-0"
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
                        className={`p-3 rounded-ctl text-12 border border-line ${
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
                      className="[&_input]:font-num"
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
                        className={`p-3 rounded-ctl text-12 border border-line ${
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
              </section>
            )}

            {current === 'appearance' && (
              <section className="ssec">
                <div className="ssec__h">
                  <div>
                    <h2>Appearance</h2>
                    <p>Light, Dark, or follow your system. Persisted across sessions.</p>
                  </div>
                </div>

                <RubberSegment
                  aria-label="Color mode"
                  items={MODES.map((m) => {
                    const Icon = m.icon;
                    return { value: m.id, label: m.label, icon: <Icon className="w-4 h-4" /> };
                  })}
                  value={mode}
                  onChange={(value) => setMode(value)}
                  trackColor="var(--hover)"
                  thumbColor="var(--ink)"
                  textColor="var(--ink-2)"
                  activeTextColor="var(--bg)"
                  size="md"
                  radius={8}
                />

                <div className="mt-6 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-14 font-semibold text-ink">Reduce motion</h3>
                    <p className="text-12 text-ink-3 mt-0.5">
                      Minimises page transitions, number count-ups and control animations.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={reduceMotion}
                    aria-label="Reduce motion"
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      reduceMotion ? 'bg-accent border-accent' : 'bg-ink-3/40 border-line'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-ink transition-transform ease-spring ${
                        reduceMotion ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </section>
            )}

            {current === 'alerts' && (
              <section className="ssec">
                <div className="ssec__h">
                  <div>
                    <h2>Article 296 Statutory Alert Protocols</h2>
                    <p>
                      Mandatory · always enforced, dispatched automatically in Asia/Manila against the strict 180-day cap
                    </p>
                  </div>
                  <span className="text-12 font-medium text-ok shrink-0">Statutory</span>
                </div>

                <div>
                  <div className="salert">
                    <div>
                      <div className="salert__t">
                        <span>Day 150 Review Due Notice</span>
                        <Badge variant="warn">Statutory Milestone</Badge>
                      </div>
                      <p className="salert__b">
                        Triggers when an employee reaches 150 days of probation. Alerts HR and supervisors to schedule the formal 5th-month performance appraisal.
                      </p>
                    </div>
                    <span className="salert__live">Enforced</span>
                  </div>

                  <div className="salert">
                    <div>
                      <div className="salert__t">
                        <span>Day 165 Written Notice Period Threshold</span>
                        <Badge variant="warn">Legal Due Process</Badge>
                      </div>
                      <p className="salert__b">
                        Guarantees the required 15-day notice buffer before Day 180. Alerts employers if any employee under target is in jeopardy of termination or regularization.
                      </p>
                    </div>
                    <span className="salert__live">Enforced</span>
                  </div>

                  <div className="salert">
                    <div>
                      <div className="salert__t">
                        <span>Day 178 Critical Action Window (48h to Auto-Regularization)</span>
                        <Badge variant="bad">Critical Threshold</Badge>
                      </div>
                      <p className="salert__b">
                        Final alert: under Philippine law, working on Day 181 confers automatic permanent regular status. Immediate action required.
                      </p>
                    </div>
                    <span className="salert__live">Enforced</span>
                  </div>
                </div>
              </section>
            )}

            {current === 'security' && (
              <section className="ssec">
                <div className="ssec__h">
                  <div>
                    <h2>Security &amp; Password</h2>
                    <p>Update your password or manage credentials</p>
                  </div>
                </div>

                {passwordStatus.message && (
                  <div
                    role="alert"
                    className={`mb-5 p-3 rounded-ctl text-12 flex items-center gap-2 border border-line ${
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
              </section>
            )}

            {current === 'system' && isAdmin && (
              <section className="ssec">
                <div className="ssec__h">
                  <div>
                    <h2>System settings</h2>
                    <p>Global statutory configuration · Administrator oversight (read-only)</p>
                  </div>
                  <Badge variant="neutral">System</Badge>
                </div>

                {isSystemError ? (
                  <p className="text-12 text-bad">Could not load system settings right now.</p>
                ) : !systemSettings ? (
                  <p className="text-12 text-ink-3">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="text-14 font-semibold text-ink">Article 296 deadline thresholds</div>
                      <p className="text-12 text-ink-3">
                        Fixed statutory milestones. Informational only, not configurable.
                      </p>
                      <ul className="space-y-1">
                        {Object.entries(systemSettings.deadline_thresholds || {}).map(([key, day]) => (
                          <li
                            key={key}
                            className="flex items-center justify-between gap-3 text-12 border-b border-line py-1.5 last:border-0"
                          >
                            <span className="text-ink-2">{THRESHOLD_LABELS[key] || prettyKey(key)}</span>
                            <span className="font-num text-ink font-semibold">{day} days</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <div className="text-14 font-semibold text-ink">Industry KPI template library</div>
                      <p className="text-12 text-ink-3">
                        Pre-built target/weight presets employers can apply in KPI Configuration.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(systemSettings.kpi_templates || {}).map(([industry, rows]) => (
                          <div key={industry} className="rounded-ctl border border-line p-3 space-y-2">
                            <div className="text-12 font-semibold text-ink">{prettyKey(industry)}</div>
                            <ul className="space-y-0.5">
                              {Object.entries(rows).map(([comp, cfg]) => (
                                <li
                                  key={comp}
                                  className="flex items-center justify-between gap-3 text-12 text-ink-3"
                                >
                                  <span>{COMPETENCY_LABELS.get(comp) || comp}</span>
                                  <span className="font-num whitespace-nowrap">
                                    {Number(cfg.target_score).toFixed(1)} · {Math.round(Number(cfg.weight) * 100)}%
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
