import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PerformaMark, Eye, EyeOff, AlertCircle, Sun, Moon } from '../../components/icons';
import { TextField, Button, Surface, inputClass, PageGrid, Row, Col } from '../../components/ui';
import { COMPETENCIES } from '../../config/domain';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

export default function Register() {
  const { register } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !organizationName.trim() || !password) {
      setError('Please complete every field.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const result = await register({ fullName, email, organizationName, password });
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="login-shell min-h-screen w-full flex flex-col bg-bg text-ink transition-colors duration-performa">
      <PageGrid container className="flex-1 flex flex-col lg:grid-rows-[auto_1fr_auto]">
        {/* Top bar — brand starts col 1, control ends col 12 */}
        <Row as="header" className="lg:items-center flex justify-between items-center gap-4 py-6">
          <Col span={5} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-nav bg-accent text-accent-foreground flex items-center justify-center">
              <PerformaMark className="w-5 h-5" />
            </div>
            <span className="font-semibold text-16 tracking-tight text-ink">Performa</span>
          </Col>

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
          {/* Form column */}
          <Col as="section" span={5}>
            <h1 className="text-30 font-semibold tracking-tight text-ink">Create your account</h1>
            <p className="text-14 text-ink-2 mt-2">
              Set up a new workspace as its Employer owner. You can invite supervisors and add
              probationary employees once you're in.
            </p>

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
                id="fullName"
                label="Full name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
                required
              />

              <TextField
                id="organizationName"
                label="Company / organization"
                type="text"
                autoComplete="organization"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Philippines Corp."
                required
              />

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
                <label className="text-12 font-medium text-ink-2 mb-1" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
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
                <p className="text-12 text-ink-3 mt-1">At least 8 characters.</p>
              </div>

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-14 text-ink-2 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Sign in
              </Link>
            </p>
          </Col>

          {/* What you're signing up for */}
          <Col as={Surface} span={6} start={7} className="p-6 sm:p-7">
            <div className="login-kicker">Employer workspace · Article 296</div>
            <h2 className="text-22 font-bold tracking-tight text-ink mt-3">
              Own your team's probation process end to end.
            </h2>
            <p className="text-14 text-ink-2 mt-2.5">
              As the Employer you assign supervisors, approve training plans, and sign off on
              regularization or termination — with an immutable audit trail behind every decision.
            </p>

            <p className="text-12 text-ink-3 mt-5">Rated weekly across 5 competencies</p>
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

        <Row as="footer" className="py-6 text-12 text-ink-3">
          <Col span={5}>Asia/Manila (UTC+8) · Article 296, Philippine Labor Code</Col>
        </Row>
      </PageGrid>
    </div>
  );
}
