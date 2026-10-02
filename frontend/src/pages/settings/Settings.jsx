import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button, Badge, StatusDot } from '../../components/ui';
import {
  User,
  Palette,
  Bell,
  Lock,
  Building,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { palette, setPalette, isDark } = useTheme();

  // Milestone Notification preferences
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('performa_milestone_notifications');
      return saved
        ? JSON.parse(saved)
        : {
            day150: true,
            day165: true,
            day178: true,
            weeklyDigest: false,
          };
    } catch {
      return { day150: true, day165: true, day178: true, weeklyDigest: false };
    }
  });

  const [notificationSaved, setNotificationSaved] = useState(false);

  const handleToggleNotification = (key) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    try {
      localStorage.setItem('performa_milestone_notifications', JSON.stringify(updated));
      setNotificationSaved(true);
      setTimeout(() => setNotificationSaved(false), 2500);
    } catch {}
  };

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordSubmit = (e) => {
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
    // Simulate updating password against auth endpoint
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setPasswordStatus({
        type: 'success',
        message: 'Password updated successfully.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 600);
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
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Settings & Appearance
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Configure system appearance, statutory alerts, and account credentials.
          </p>
        </div>
      </header>

      {/* 1. Account Profile Card */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
          <div className="w-9 h-9 rounded-nav bg-accent/10 text-accent flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">User Profile & Tenant</h2>
            <p className="text-xs text-ink-3">Your credentials and organization context</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-[11px] text-ink-3 uppercase tracking-wider font-mono block mb-1">
              Full Name
            </span>
            <span className="text-sm font-semibold text-ink">{user?.full_name || 'User'}</span>
          </div>

          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-[11px] text-ink-3 uppercase tracking-wider font-mono block mb-1">
              Work Email
            </span>
            <span className="text-sm font-mono text-ink truncate block">{user?.email}</span>
          </div>

          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-[11px] text-ink-3 uppercase tracking-wider font-mono block mb-1">
              Platform Role
            </span>
            <span className="text-sm font-semibold text-accent capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>

          <div className="p-3.5 rounded-ctl bg-hover border border-line">
            <span className="text-[11px] text-ink-3 uppercase tracking-wider font-mono block mb-1">
              Organization
            </span>
            <span className="text-sm font-semibold text-ink flex items-center gap-1.5 truncate">
              <Building className="w-3.5 h-3.5 text-ink-3 shrink-0" />
              <span>Acme Philippines Corp.</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Theme & Palette Selection */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
          <div className="w-9 h-9 rounded-nav bg-accent/10 text-accent flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Design Theme & Palette</h2>
            <p className="text-xs text-ink-3">
              Switch between 5 curated semantic color systems. Persisted across sessions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {palettes.map((p) => {
            const isSelected = palette === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setPalette(p.id)}
                className={`p-4 rounded-ctl border cursor-pointer transition-all duration-performa ${
                  isSelected
                    ? 'border-accent bg-accent/5 ring-1 ring-accent shadow-sm'
                    : 'border-line bg-surface hover:bg-hover hover:border-ink-3'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border border-line shrink-0 shadow-xs"
                      style={{ backgroundColor: p.bg }}
                    />
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.accent }}
                    />
                    <span className="font-semibold text-sm text-ink">{p.name}</span>
                  </div>
                  <Badge variant={p.type === 'Dark' ? 'accent' : 'neutral'}>{p.type}</Badge>
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">{p.desc}</p>
                {isSelected && (
                  <div className="mt-3 pt-2.5 border-t border-line flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Palette</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Article 296 Statutory Milestone Notifications */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-line flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-nav bg-warn/10 text-warn flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Philippine Labor Code Article 296 Alerts
              </h2>
              <p className="text-xs text-ink-3">
                Mandatory alerts calculated in Asia/Manila against the strict 180-day cap
              </p>
            </div>
          </div>
          {notificationSaved && (
            <span className="text-xs font-medium text-ok flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Preferences saved</span>
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-3.5 rounded-ctl bg-hover border border-line">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink">Day 150 Review Due Notice</span>
                <Badge variant="warn">Statutory Milestone</Badge>
              </div>
              <p className="text-xs text-ink-2">
                Triggers when an employee reaches 150 days of probation. Alerts HR and supervisors to schedule the formal 5th-month performance appraisal.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={notifications.day150}
                onChange={() => handleToggleNotification('day150')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
            </label>
          </div>

          <div className="flex items-start justify-between gap-4 p-3.5 rounded-ctl bg-hover border border-line">
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
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={notifications.day165}
                onChange={() => handleToggleNotification('day165')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
            </label>
          </div>

          <div className="flex items-start justify-between gap-4 p-3.5 rounded-ctl bg-hover border border-line">
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
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={notifications.day178}
                onChange={() => handleToggleNotification('day178')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bad" />
            </label>
          </div>
        </div>
      </section>

      {/* 4. Security & Password Update */}
      <section className="bg-surface border border-line rounded-float p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
          <div className="w-9 h-9 rounded-nav bg-accent/10 text-accent flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Security & Password</h2>
            <p className="text-xs text-ink-3">Update your password or manage credentials</p>
          </div>
        </div>

        {passwordStatus.message && (
          <div
            className={`mb-5 p-3 rounded-ctl text-xs flex items-center gap-2 ${
              passwordStatus.type === 'error'
                ? 'bg-bad/10 text-bad border border-bad/20'
                : 'bg-ok/10 text-ok border border-ok/20'
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
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="currPass">
              Current Password
            </label>
            <input
              id="currPass"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="newPass">
              New Password
            </label>
            <input
              id="newPass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-10 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="confPass">
              Confirm New Password
            </label>
            <input
              id="confPass"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <Button type="submit" variant="primary" isLoading={isUpdatingPassword} className="mt-2">
            Update Password
          </Button>
        </form>
      </section>
    </div>
  );
}
