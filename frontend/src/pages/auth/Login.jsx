import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const { palette, setPalette } = useTheme();
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
        navigate('/admin/overview');
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

  const palettes = ['paper', 'midnight', 'dusk', 'mist', 'sage'];

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-bg text-ink transition-colors duration-performa">
      {/* Top bar with Theme Switcher */}
      <header className="w-full flex justify-between items-center px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-nav bg-accent text-accent-foreground flex items-center justify-center shadow-sm">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-base tracking-tight text-ink">Performa</span>
        </div>

        {/* Palette Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3 hidden sm:inline">Theme:</span>
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-hover border border-line">
            {palettes.map((p) => (
              <button
                key={p}
                onClick={() => setPalette(p)}
                className={`w-6 h-6 rounded-full border transition-transform ${
                  palette === p ? 'border-ink scale-110 shadow-sm' : 'border-line hover:scale-105'
                }`}
                title={`Switch to ${p} theme`}
                aria-label={`Switch to ${p} theme`}
                style={{
                  backgroundColor:
                    p === 'paper'
                      ? '#f6f3ed'
                      : p === 'midnight'
                      ? '#090b10'
                      : p === 'dusk'
                      ? '#0c0a14'
                      : p === 'mist'
                      ? '#f0f4f8'
                      : '#edf2ee',
                }}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-surface border border-line rounded-float p-6 sm:p-8 shadow-pop transition-colors duration-performa">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Sign in to Performa</h1>
            <p className="text-sm text-ink-2 mt-1.5">
              Philippine Labor Code Article 296 Evaluation Platform
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-ctl bg-bad/8 border border-line flex items-start gap-2.5 text-bad text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-none" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5" htmlFor="email">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full h-10 px-3 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-ink-2" htmlFor="password">
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
                  className="w-full h-10 pl-3 pr-10 border border-line rounded-field bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-accent transition-colors"
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
              className="w-full h-10 mt-2 bg-accent text-accent-foreground font-semibold rounded-ctl text-sm hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
            <span className="block text-xs font-medium text-ink-3 mb-2.5 text-center">
              Quick demo login (Seeded accounts):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@acme.com')}
                className="px-2.5 py-1.5 text-xs font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('employer@acme.com')}
                className="px-2.5 py-1.5 text-xs font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Employer
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('supervisor@acme.com')}
                className="px-2.5 py-1.5 text-xs font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Supervisor
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('emp1@acme.com')}
                className="px-2.5 py-1.5 text-xs font-medium rounded-ctl border border-line hover:bg-hover hover:border-ink-3 transition-colors text-ink text-center"
              >
                Employee
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="w-full text-center py-4 text-xs text-ink-3 border-t border-line">
        <span>Strict 180-Day Timeline & Statutory Milestones (Days 150, 165, 178) · Asia/Manila</span>
      </footer>
    </div>
  );
}
