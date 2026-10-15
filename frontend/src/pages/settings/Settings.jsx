import React, { useEffect, useMemo, useState } from 'react';
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
  Label,
  inputClass,
} from '../../components/ui';
import { CheckCircle2, AlertCircle, Sun, Moon, Monitor, Lock } from '../../components/icons';
import { getInitials } from '../../utils/format';

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

// One rule for every save button on this page: a save is enabled only when there
// is something to submit. Profile/Account compare against the saved account
// value; the password form (which has no stored value to compare) is dirty once
// any field has input. `caseInsensitive` is for the email, normalized on save.
const differs = (value, saved, caseInsensitive = false) => {
  const current = String(value ?? '').trim();
  const original = String(saved ?? '').trim();
  return caseInsensitive
    ? current.toLowerCase() !== original.toLowerCase()
    : current !== original;
};

// Split a stored full name into first / middle / last. The first word is the
// first name, the last word is the last name, and anything between is the middle
// name. A single word becomes the first name only.
const splitFullName = (full) => {
  const words = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: '', middle: '', last: '' };
  if (words.length === 1) return { first: words[0], middle: '', last: '' };
  return {
    first: words[0],
    middle: words.slice(1, -1).join(' '),
    last: words[words.length - 1],
  };
};

const joinFullName = (first, middle, last) =>
  [first, middle, last]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
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

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { mode, setMode, reduceMotion, setReduceMotion } = useTheme();

  // Administrators get an extra read-only "System settings" section (Manuscript
  // Scope: global deadline thresholds + industry KPI template library). The rest
  // of the roles never see it.
  const isAdmin = user?.role === 'admin';
  // Organization (tenant) rename is Admin/Employer only.
  const canManageOrg = user?.role === 'admin' || user?.role === 'employer';

  const { data: systemSettings, isError: isSystemError } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings(),
    enabled: isAdmin,
  });

  // Left-rail sections — one entry per rendered block, role-aware.
  const sections = useMemo(() => {
    const list = [
      { id: 'profile', label: 'Profile' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'security', label: 'Security' },
      { id: 'alerts', label: 'Milestone alerts' },
    ];
    if (canManageOrg) list.push({ id: 'account', label: 'Account' });
    if (isAdmin) list.push({ id: 'system', label: 'System' });
    return list;
  }, [canManageOrg, isAdmin]);

  const [activeSection, setActiveSection] = useState('profile');

  // Highlight the rail entry for the section currently in view. jsdom has no
  // IntersectionObserver, so the observer is skipped under test.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  // Profile edit state. The account stores one full_name string; the form edits
  // it as first / middle / last and joins them back on save.
  const initialName = splitFullName(user?.full_name);
  const [profileFirst, setProfileFirst] = useState(initialName.first);
  const [profileMiddle, setProfileMiddle] = useState(initialName.middle);
  const [profileLast, setProfileLast] = useState(initialName.last);
  const profileName = joinFullName(profileFirst, profileMiddle, profileLast);
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Unsaved-changes gates: one rule for every save button on this page.
  const isProfileDirty = useMemo(
    () => differs(profileName, user?.full_name) || differs(profileEmail, user?.email, true),
    [profileName, profileEmail, user]
  );

  // Organization rename state (Admin/Employer only)
  const [orgName, setOrgName] = useState(user?.organization_name || '');
  const [orgStatus, setOrgStatus] = useState({ type: '', message: '' });
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const isOrgDirty = useMemo(() => differs(orgName, user?.organization_name), [orgName, user]);

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
    if (!profileFirst.trim() || !profileLast.trim() || !profileEmail.trim()) {
      setProfileStatus({ type: 'error', message: 'First name, last name, and email are required.' });
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
  // No stored password to compare against — dirty once anything is typed.
  const isPasswordDirty = Boolean(currentPassword || newPassword || confirmPassword);

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

  const statusAlert = (status, className = 'mb-4') =>
    status.message ? (
      <div
        role="alert"
        className={`${className} p-3 rounded-ctl text-12 flex items-center gap-2 border border-line ${
          status.type === 'error' ? 'bg-bad/8 text-bad' : 'bg-ok/8 text-ok'
        }`}
      >
        {status.type === 'error' ? (
          <AlertCircle className="w-4 h-4 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        )}
        <span>{status.message}</span>
      </div>
    ) : null;

  return (
    <Page title="Settings">
      <PageGrid>
        <Row className="lg:items-start lg:gap-y-0">
          {/* Left anchor rail (horizontal scroll on small screens) */}
          <Col span={3} className="lg:sticky lg:top-0 lg:self-start">
            <nav
              aria-label="Settings sections"
              className="flex gap-1 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {sections.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setActiveSection(s.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`shrink-0 rounded-ctl px-3 py-2 text-14 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-accent/10 text-ink font-semibold'
                        : 'text-ink-3 hover:bg-hover hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </a>
                );
              })}
            </nav>
          </Col>

          {/* Content column — one block per section, hairline-separated */}
          <Col span={9} className="mt-6 divide-y divide-line lg:mt-0">
            {/* Profile */}
            <section id="profile" aria-label="Profile" className="scroll-mt-4 pb-10">
              <SectionHead title="Profile" subtitle="The information used for your account" />

              <div className="flex items-center gap-3 py-4 border-b border-line">
                <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/20 text-accent font-semibold text-14 flex items-center justify-center shrink-0">
                  {getInitials(user?.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="text-14 font-medium text-ink">Profile photo</div>
                  <div className="text-12 text-ink-3">Generated automatically from your name.</div>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="pt-4">
                {statusAlert(profileStatus)}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <TextField
                      id="p_first"
                      label="First name"
                      type="text"
                      autoComplete="given-name"
                      value={profileFirst}
                      onChange={(e) => setProfileFirst(e.target.value)}
                    />
                    <TextField
                      id="p_middle"
                      label="Middle name (optional)"
                      type="text"
                      autoComplete="additional-name"
                      value={profileMiddle}
                      onChange={(e) => setProfileMiddle(e.target.value)}
                    />
                    <TextField
                      id="p_last"
                      label="Last name"
                      type="text"
                      autoComplete="family-name"
                      value={profileLast}
                      onChange={(e) => setProfileLast(e.target.value)}
                    />
                  </div>
                  <TextField
                    id="p_email"
                    label="Email address"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="[&_input]:font-num"
                  />
                  <div>
                    <Label htmlFor="p_role">Role</Label>
                    <div className="relative">
                      <input
                        id="p_role"
                        value={user?.role?.replace(/_/g, ' ') || ''}
                        disabled
                        readOnly
                        className={`${inputClass} pr-10 capitalize disabled:bg-hover disabled:text-ink-3`}
                      />
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-5">
                  {isProfileDirty && <span className="text-12 text-ink-3">Unsaved changes</span>}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!isProfileDirty}
                    isLoading={isSavingProfile}
                  >
                    Save changes
                  </Button>
                </div>
              </form>
            </section>

            {/* Appearance */}
            <section id="appearance" aria-label="Appearance" className="scroll-mt-4 py-10">
              <SectionHead
                title="Appearance"
                subtitle="Choose how Performa looks · changes apply instantly"
              />

              <div className="pt-4">
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
              </div>

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

            {/* Security */}
            <section id="security" aria-label="Security" className="scroll-mt-4 py-10">
              <SectionHead
                title="Security"
                subtitle="Change the password used to access your account"
              />

              <form onSubmit={handlePasswordSubmit} className="pt-4">
                {statusAlert(passwordStatus)}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <TextField
                    id="currPass"
                    label="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <TextField
                    id="newPass"
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
                  />
                  <TextField
                    id="confPass"
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="sm:col-span-2"
                  />
                </div>
                <div className="flex justify-end pt-5">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!isPasswordDirty}
                    isLoading={isUpdatingPassword}
                  >
                    Update password
                  </Button>
                </div>
              </form>
            </section>

            {/* Review milestone alerts */}
            <section id="alerts" aria-label="Review milestone alerts" className="scroll-mt-4 py-10">
              <SectionHead
                title="Review milestone alerts"
                subtitle="Article 296 · mandatory · always enforced · Asia/Manila"
              />
              <div>
                {STATUTORY_ALERTS.map((a) => (
                  <div key={a.title} className="border-t border-line py-3.5 first:border-t-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <span className="text-14 font-semibold text-ink">{a.title}</span>
                      <Badge variant={a.tone}>{a.badge}</Badge>
                    </div>
                    <p className="mt-1 text-14 leading-relaxed text-ink-2">{a.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Account — tenant name (Admin/Employer) */}
            {canManageOrg && (
              <section id="account" aria-label="Account" className="scroll-mt-4 py-10">
                <SectionHead title="Account" subtitle="Your organization (tenant) name" />
                <form onSubmit={handleOrgSubmit} className="pt-4">
                  {statusAlert(orgStatus)}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <TextField
                      id="org_name"
                      label="Organization name"
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-5">
                    {isOrgDirty && <span className="text-12 text-ink-3">Unsaved changes</span>}
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!isOrgDirty}
                      isLoading={isSavingOrg}
                    >
                      Save organization
                    </Button>
                  </div>
                </form>
              </section>
            )}

            {/* System settings — Administrator only, read-only */}
            {isAdmin && (
              <section id="system" aria-label="System settings" className="scroll-mt-4 py-10">
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
                  <div className="space-y-6 pt-2">
                    <div className="space-y-2">
                      <div className="text-14 font-semibold text-ink">
                        Article 296 deadline thresholds
                      </div>
                      <p className="text-12 text-ink-3">
                        Fixed review milestones. Informational only, not configurable.
                      </p>
                      <ul className="space-y-1">
                        {Object.entries(systemSettings.deadline_thresholds || {}).map(
                          ([key, day]) => (
                            <li
                              key={key}
                              className="flex items-center justify-between gap-3 text-12 border-b border-line py-1.5 last:border-0"
                            >
                              <span className="text-ink-2">{THRESHOLD_LABELS[key] || prettyKey(key)}</span>
                              <span className="font-num text-ink font-semibold">{day} days</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <div className="text-14 font-semibold text-ink">
                        Industry KPI template library
                      </div>
                      <p className="text-12 text-ink-3">
                        Pre-built target/weight presets employers can apply in KPI Configuration.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                        {Object.entries(systemSettings.kpi_templates || {}).map(
                          ([industry, rows]) => (
                            <div key={industry} className="space-y-2">
                              <div className="text-12 font-semibold text-ink">{prettyKey(industry)}</div>
                              <ul className="space-y-0.5">
                                {Object.entries(rows).map(([comp, cfg]) => (
                                  <li
                                    key={comp}
                                    className="flex items-center justify-between gap-3 text-12 text-ink-3"
                                  >
                                    <span>{COMPETENCY_LABELS.get(comp) || comp}</span>
                                    <span className="font-num whitespace-nowrap">
                                      {Number(cfg.target_score).toFixed(1)} ·{' '}
                                      {Math.round(Number(cfg.weight) * 100)}%
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </Col>
        </Row>
      </PageGrid>
    </Page>
  );
}
