import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PerformaMark, AlertCircle, Sun, Moon, Eye, EyeOff } from '../../components/icons';
import { TextField, Button, PageGrid, Row, Col } from '../../components/ui';
import { homeForRole } from '../../App';
import { generatePassword } from '../../utils/password';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fills both fields and reveals the result, so the user can see and copy it.
  const handleGenerate = () => {
    const generated = generatePassword();
    setPassword(generated);
    setConfirm(generated);
    setShowPassword(true);
    setCopied(false);
    setError('');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    const result = await resetPassword(token, password);
    setIsSubmitting(false);
    if (result.success) {
      navigate(homeForRole(result.user?.role));
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="login-shell min-h-screen w-full flex flex-col bg-bg text-ink transition-colors duration-performa">
      <PageGrid container className="flex-1 flex flex-col lg:grid-rows-[auto_1fr_auto]">
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

        <Row as="main" className="reveal flex-1 flex flex-col justify-center pb-12">
          <Col as="section" span={6} start={4}>
            <h1 className="text-30 font-semibold tracking-tight text-ink">Set a new password</h1>
            <p className="text-14 text-ink-2 mt-2">
              Choose a new password for your Performa account.
            </p>

            {!token ? (
              <div
                role="alert"
                className="mt-6 p-3 rounded-ctl bg-bad/8 border border-line flex items-start gap-2 text-bad text-14"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-none" />
                <span>This reset link is missing its token. Request a new one.</span>
              </div>
            ) : (
              <>
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
                    id="password"
                    label="New password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
                    required
                  />
                  <TextField
                    id="confirm"
                    label="Confirm new password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={handleGenerate}>
                      Generate password
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={showPassword ? EyeOff : Eye}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                    {password && (
                      <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </div>
                  <Button type="submit" isLoading={isSubmitting} className="w-full">
                    {isSubmitting ? 'Saving…' : 'Set new password'}
                  </Button>
                </form>
              </>
            )}

            <p className="text-12 text-ink-2 mt-6">
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </Col>
        </Row>

        <Row as="footer" className="py-6 text-12 text-ink-3">
          <Col span={5}>Asia/Manila (UTC+8) · Article 296, Philippine Labor Code</Col>
        </Row>
      </PageGrid>
    </div>
  );
}
