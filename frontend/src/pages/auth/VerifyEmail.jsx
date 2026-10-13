import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PerformaMark, AlertCircle, Sun, Moon } from '../../components/icons';
import { PageGrid, Row, Col } from '../../components/ui';
import { homeForRole } from '../../App';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

export default function VerifyEmail() {
  const { verifyEmail } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function run() {
      if (!token) {
        setError('This verification link is missing its token.');
        return;
      }
      const result = await verifyEmail(token);
      if (!active) return;
      if (result.success) {
        navigate(homeForRole(result.user?.role));
      } else {
        setError(result.error);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [token, verifyEmail, navigate]);

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
                    isActive ? 'bg-surface text-ink border border-line' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </Col>
        </Row>

        <Row as="main" className="reveal flex-1 flex flex-col justify-center pb-12 lg:justify-start">
          <Col as="section" span={5}>
            <h1 className="text-30 font-semibold tracking-tight text-ink">Verifying your email</h1>

            {error ? (
              <div
                role="alert"
                className="mt-6 p-3 rounded-ctl bg-bad/8 border border-line flex items-start gap-2 text-bad text-14"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-none" />
                <span>{error}</span>
              </div>
            ) : (
              <p className="text-14 text-ink-2 mt-2" role="status">
                Activating your account…
              </p>
            )}

            <p className="text-14 text-ink-2 mt-6">
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
