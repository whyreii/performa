import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, getApiErrorMessage } from '../../api';
import { useTheme } from '../../context/ThemeContext';
import { PerformaMark, AlertCircle, Sun, Moon, CheckCircle2 } from '../../components/icons';
import { TextField, Button, PageGrid, Row, Col } from '../../components/ui';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

export default function ForgotPassword() {
  const { mode, setMode } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your work email.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      setIsSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send a reset link right now.'));
    } finally {
      setIsSubmitting(false);
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
            <h1 className="text-30 font-semibold tracking-tight text-ink">Reset your password</h1>
            <p className="text-14 text-ink-2 mt-2">
              Enter your work email and we'll send a reset link if an account exists.
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

            {isSent ? (
              <div
                role="status"
                className="mt-7 p-4 rounded-ctl bg-ok/8 border border-line flex items-start gap-2 text-ok text-14"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" />
                <span>
                  If an account exists for <span className="font-num">{email.trim()}</span>, a reset
                  link is on its way. Check your inbox.
                </span>
              </div>
            ) : (
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
                <Button type="submit" isLoading={isSubmitting} className="w-full">
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
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
