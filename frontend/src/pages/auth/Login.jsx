import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PerformaMark, Eye, EyeOff, AlertCircle, Sun, Moon } from '../../components/icons';
import { TextField, Button, Surface, Badge, inputClass, PageGrid, Row, Col } from '../../components/ui';
import { COMPETENCIES } from '../../config/domain';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

// Demo quick-login is a dev-only aid. Gated so the seeded emails and the plain
// demo password are tree-shaken out of production bundles.
const SHOW_DEMO = import.meta.env.DEV;

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
      <PageGrid container className="flex-1 flex flex-col lg:grid-rows-[auto_1fr_auto]">
      {/* Top bar — the first row; brand starts col 1, control ends col 12 */}
      <Row as="header" className="lg:items-center flex justify-between items-center gap-4 py-6">
        <Col span={5} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-nav bg-accent text-accent-foreground flex items-center justify-center">
            <PerformaMark className="w-5 h-5" />
          </div>
          <span className="font-semibold text-16 tracking-tight text-ink">Performa</span>
        </Col>

        {/* Color mode */}
        <Col
          span={6}
          start={7}
          role="group"
          aria-label="Color mode"
          className="lg:justify-self-end flex items-center gap-1 p-1 rounded-ctl border border-line bg-hover"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isActive}
                aria-label={`${m.label} mode`}
                title={m.label}
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center justify-center h-8 w-8 rounded-ctl transition-colors ${
                  isActive
                    ? 'bg-surface text-ink border border-line'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </Col>
      </Row>

      <Row as="main" className="reveal flex-1 flex flex-col justify-center gap-10 pb-12 lg:gap-y-0 lg:items-start lg:content-center">
          {/* Form column (heading + form + demo) */}
          <Col as="section" span={5}>
            <h1 className="text-30 font-semibold tracking-tight text-ink">Sign in</h1>
            <p className="text-14 text-ink-2 mt-2">Use your work account to continue to Performa.</p>

            {error && (
              <div
                role="alert"
                className="mt-6 p-3 rounded-ctl bg-bad/8 border border-line flex items-start gap-2 text-bad text-14"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-none" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-7">
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
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="text-14 text-ink-2 mt-6">
              New to Performa?{' '}
              <Link to="/register" className="font-semibold text-accent hover:underline">
                Create an account
              </Link>
            </p>

            {SHOW_DEMO && (
              <>
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
              </>
            )}
          </Col>

          {/* Article 296 card */}
          <Col as={Surface} span={6} start={7} className="p-6 sm:p-7">
            <div className="login-kicker">Article 296 · Philippine Labor Code</div>
            <h2 className="text-22 font-bold tracking-tight text-ink mt-3">
              Ratings, deadlines, and the audit trail behind every decision.
            </h2>
            <p className="text-14 text-ink-2 mt-2.5">
              Supervisors rate weekly across the 5 competencies. Training plans need employer
              approval, and every score change is written to an immutable audit trail.
            </p>

            <p className="text-12 text-ink-3 mt-5">Rated across 5 competencies</p>
            <ul className="mt-2 border-t border-line divide-y divide-line">
              {COMPETENCIES.map((c, i) => (
                <li key={c.key} className="flex items-baseline gap-3 py-2 text-14">
                  <span className="num w-5 shrink-0 text-12 text-ink-3">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-ink-2">{c.label}</span>
                </li>
              ))}
            </ul>
          </Col>
      </Row>

      {/* Footer — the third row, on the same column lines */}
      <Row as="footer" className="py-6 text-12 text-ink-3">
        <Col span={5}>Asia/Manila (UTC+8) · Article 296, Philippine Labor Code</Col>
      </Row>
      </PageGrid>
    </div>
  );
}
