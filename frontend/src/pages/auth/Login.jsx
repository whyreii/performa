import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, Eye, EyeOff, AlertCircle, ArrowRight, Sun, Moon, Monitor } from '../../components/icons';
import { TextField, Surface } from '../../components/ui';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
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
    <div className="min-h-screen w-full flex flex-col justify-between bg-bg text-ink transition-colors duration-performa">
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

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Surface elevated className="w-full max-w-[420px] p-6 sm:p-8 transition-colors duration-performa">
          <div className="text-center mb-6">
            <h1 className="text-22 sm:text-30 font-semibold tracking-tight text-ink">Sign in to Performa</h1>
            <p className="text-14 text-ink-2 mt-1.5">
              Philippine Labor Code Article 296 Evaluation Platform
            </p>
          </div>

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
              label="Work Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-12 font-medium text-ink-2" htmlFor="password">
                  Password
                </label>
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
                  className="w-full h-10 pl-3 pr-10 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-14 focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 mt-2 bg-accent text-accent-foreground font-semibold rounded-ctl text-14 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Login Test Accounts for Panel Demo */}
          <div className="mt-6 pt-5 border-t border-line">
            <span className="block text-12 font-medium text-ink-3 mb-2.5 text-center">
              Quick demo login (Seeded accounts):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@acme.com')}
                className="px-2.5 py-1.5 text-12 font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('employer@acme.com')}
                className="px-2.5 py-1.5 text-12 font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Employer
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('supervisor@acme.com')}
                className="px-2.5 py-1.5 text-12 font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Supervisor
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('emp1@acme.com')}
                className="px-2.5 py-1.5 text-12 font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Employee
              </button>
            </div>
          </div>
        </Surface>
      </main>

      {/* Footer info */}
      <footer className="w-full text-center py-4 text-12 text-ink-3 border-t border-line">
        <span>Strict 180-Day Timeline & Statutory Milestones (Days 150, 165, 178) · Asia/Manila</span>
      </footer>
    </div>
  );
}
