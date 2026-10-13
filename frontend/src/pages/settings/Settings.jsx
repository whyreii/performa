import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi, adminApi, organizationApi, getApiErrorMessage } from '../../api';
import { COMPETENCIES } from '../../config/domain';
import {
  Button,
  Badge,
  TextField,
  Page,
  PageGrid,
  Row,
  Col,
  SectionHead,
  RubberSegment,
} from '../../components/ui';
import {
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
} from '../../components/icons';

// Review-milestone day labels + competency/industry display helpers.
const THRESHOLD_LABELS = {
  day_150: 'Day 150 · Performance appraisal',
  day_165: 'Day 165 · Milestone review',
  day_178: 'Day 178 · Final milestone',
  day_180: 'Day 180 · Probation cap',
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

// Article 296 review-milestone protocols — fixed, always enforced.
const STATUTORY_ALERTS = [
  {
    title: 'Day 150 · Performance appraisal',
    badge: 'Milestone',
    tone: 'warn',
    body: 'Triggers when an employee reaches Day 150 of probation, so the employer can schedule the performance appraisal before the Day 180 cap.',
  },
  {
    title: 'Day 165 · Milestone review',
    badge: 'Milestone',
    tone: 'warn',
    body: 'Prompts a review of any employee still below the 4.0 standard, with 15 days left before the Day 180 cap.',
  },
  {
    title: 'Day 178 · Final milestone',
    badge: 'Final milestone',
    tone: 'bad',
    body: 'Final alert: under Article 296, an employee who continues to work past Day 180 is regularized (constructive regularization). Record the outcome.',
  },
];

// One label/value line in the profile block (label column, value column).
function ProfileRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <span className="text-14 text-ink-3">{label}</span>
      <span className="min-w-0 text-14 text-ink">{children}</span>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { mode, setMode, reduceMotion, setReduceMotion } = useTheme();

  // Administrators get an extra read-only "System settings" section (Manuscript
  // Scope: global deadline thresholds + industry KPI template library). The rest
  // of the roles never see it.
  const isAdmin = user?.role === 'admin';

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
    <Page title="Settings">
      <PageGrid className="space-y-10 lg:space-y-0 lg:gap-y-10">
        {/* Profile & tenant — full width */}
        <Row>
          <Col span={12}>
            <section aria-label="User profile and tenant">
              <SectionHead
                title="User Profile &amp; Tenant"
                note={
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
                }
              />

              <div className="divide-y divide-line">
                <ProfileRow label="Full Name">{user?.full_name || 'User'}</ProfileRow>
                <ProfileRow label="Work Email">
                  <span className="font-num">{user?.email}</span>
                </ProfileRow>
                <ProfileRow label="Platform Role">
                  <span className="capitalize">{user?.role?.replace(/_/g, ' ')}</span>
                </ProfileRow>
                <ProfileRow label="Organization">
                  <span className="inline-flex items-center gap-3 min-w-0">
                    <span className="truncate">
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
                        className="shrink-0 text-12 text-accent hover:underline"
                      >
                        {isEditingOrg ? 'Cancel' : 'Rename'}
                      </button>
                    )}
                  </span>
                </ProfileRow>
              </div>

              {isEditingProfile && (
                <form
                  onSubmit={handleProfileSubmit}
                  className="mt-5 space-y-4 border-t border-line pt-5 max-w-md"
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
                  className="mt-5 space-y-4 border-t border-line pt-5 max-w-md"
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
          </Col>
        </Row>

        {/* Appearance (7) | Security (5) */}
        <Row className="lg:items-start">
          <Col span={7}>
            <section aria-label="Appearance">
              <SectionHead title="Appearance" subtitle="Light, Dark, or follow your system" />

              <RubberSegment
                aria-label="Color mode"
                items={MODES.map((m) => {
                  const Icon = m.icon;
                  return { value: m.id, label: m.label, icon: <Icon className="w-4 h-4" /> };
                })}
                value={mode}
                onChange={(value) => setMode(value)}
                trackColor="var(--hover)"
                thumbColor="var(--accent)"
                textColor="var(--ink-2)"
                activeTextColor="var(--on-accent)"
                size="md"
                radius={999}
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
                    reduceMotion ? 'bg-accent border-accent' : 'bg-ink-3/50 border-line'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full transition-transform ease-spring ${
                      reduceMotion ? 'bg-accent-foreground translate-x-6' : 'bg-ink translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </section>
          </Col>

          <Col span={5}>
            <section aria-label="Security">
              <SectionHead title="Security &amp; Password" subtitle="Update your password" />

              {passwordStatus.message && (
                <div
                  role="alert"
                  className={`mb-5 p-3 rounded-ctl text-12 flex items-center gap-2 border border-line ${
                    passwordStatus.type === 'error' ? 'bg-bad/8 text-bad' : 'bg-ok/8 text-ok'
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

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
          </Col>
        </Row>

        {/* Article 296 review-milestone protocols — full width */}
        <Row>
          <Col span={12}>
              <section aria-label="Review milestone alerts">
              <SectionHead
                title="Article 296 Alert Protocols"
                subtitle="Mandatory · always enforced · Asia/Manila"
              />
              <div>
                {STATUTORY_ALERTS.map((a) => (
                  <div
                    key={a.title}
                    className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-line py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_150px_90px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="text-14 font-semibold text-ink">{a.title}</div>
                      <p className="mt-0.5 text-14 leading-relaxed text-ink-2">{a.body}</p>
                    </div>
                    <div>
                      <Badge variant={a.tone}>{a.badge}</Badge>
                    </div>
                    <span className="text-12 font-semibold text-good sm:text-right">Enforced</span>
                  </div>
                ))}
              </div>
            </section>
          </Col>
        </Row>

        {/* Administrator-only read-only system settings */}
        {isAdmin && (
          <Row>
            <Col span={12}>
              <section aria-label="System settings">
                <SectionHead
                  title="System settings"
                  subtitle="Global review-milestone configuration · Administrator oversight (read-only)"
                  note={<Badge variant="neutral">System</Badge>}
                />
                {isSystemError ? (
                  <p className="text-12 text-bad">Could not load system settings right now.</p>
                ) : !systemSettings ? (
                  <p className="text-12 text-ink-3">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="text-14 font-semibold text-ink">Article 296 deadline thresholds</div>
                      <p className="text-12 text-ink-3">
                        Fixed review milestones. Informational only, not configurable.
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
            </Col>
          </Row>
        )}
      </PageGrid>
    </Page>
  );
}
