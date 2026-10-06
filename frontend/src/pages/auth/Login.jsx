import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, Eye, EyeOff, AlertCircle, Sun, Moon, Monitor } from '../../components/icons';
import { TextField, Button, Surface, Badge, inputClass } from '../../components/ui';
import { COMPETENCIES } from '../../config/domain';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

// Seeded accounts for the panel demo — real logins, not fabricated data.
const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@acme.com' },
  { role: 'Employer', email: 'employer@acme.com' },
  { role: 'Supervisor', email: 'supervisor@acme.com' },
  { role: 'Probationary employee', email: 'emp1@acme.com' },
];

export default function Login() {
  const { login } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both your email and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      const role = result.user?.role;
      if (role === 'admin') {
        navigate('/admin/users');
      } else if (role === 'probationary_employee') {
        navigate('/employee/dashboard');
      } else if (role === 'supervisor') {
        navigate('/supervisor/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
  };

  const handleQuickLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError('');
  };

  return (
    <div className="login-shell min-h-screen w-full flex flex-col bg-bg text-ink transition-colors duration-performa">
      {/* Top bar with Color mode */}
      <header className="w-full flex justify-between items-center px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-nav bg-accent text-accent-foreground flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-16 tracking-tight text-ink">Performa</span>
        </div>

        {/* Color mode */}
        <div
          role="tablist"
          aria-label="Color mode"
          className="flex items-center gap-1 p-1 rounded-ctl border border-line bg-hover"
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
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl text-12 transition-colors ${
                  isActive
                    ? 'bg-surface text-ink font-semibold border border-line'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1180px] mx-auto px-6 py-10 flex flex-col justify-center">
        <header className="reveal">
          <h1 className="text-30 font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="text-14 text-ink-2 mt-2">Use your work account to continue to Performa.</p>
        </header>

        <div className="reveal mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:items-start">
          {/* Form column */}
          <section>
            {error && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-ctl bg-bad/8 border border-line flex items-start gap-2 text-bad text-14"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-none" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                id="email"
                label="Work email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />

              <div>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <label className="text-12 font-medium text-ink-2" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-12 font-semibold text-accent hover:underline"
                    onClick={() => {}}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="h-px bg-line my-6" />

            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-14 font-semibold text-ink">Fill a seeded demo account</span>
              <Badge variant="warn">Demo mode</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleQuickLogin(account.email)}
                  className="flex flex-col items-start gap-0.5 text-left border border-line rounded-field bg-surface px-3.5 py-3 hover:border-accent/60 hover:bg-hover transition-colors"
                >
                  <span className="text-12 font-semibold text-ink">{account.role}</span>
                  <span className="num text-12 text-ink-3">{account.email}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Article 296 promo */}
          <Surface className="p-6 sm:p-7 lg:-mt-6">
            <div className="login-kicker">Article 296 · Philippine Labor Code</div>
            <h2 className="text-22 font-bold tracking-tight text-ink mt-3">
              Every probationary period, tracked to day 180.
            </h2>
            <p className="text-14 text-ink-2 mt-2.5">
              Weekly ratings, training plans that only an employer can approve, and an audit
              trail on every score change.
            </p>

            <p className="text-12 text-ink-3 mt-5">Rated across 5 competencies</p>
            <ul className="mt-2 border-t border-line divide-y divide-line">
              {COMPETENCIES.map((c) => (
                <li key={c.key} className="py-2 text-14 text-ink-2">
                  {c.label}
                </li>
              ))}
            </ul>
          </Surface>
        </div>
      </main>

      {/* Footer info */}
      <footer className="w-full text-center py-4 text-12 text-ink-3 border-t border-line">
        <span>Strict 180-Day Timeline & Statutory Milestones (Days 150, 165, 178) · Asia/Manila</span>
      </footer>
    </div>
  );
}
