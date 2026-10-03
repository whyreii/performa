import React from 'react';

/**
 * Top-level React error boundary.
 *
 * Catches render/lifecycle errors anywhere below it and shows a token-styled
 * fallback with a reload action instead of a blank screen. In development the
 * error message is surfaced to aid debugging; in production it is hidden.
 * Uses only React 18 built-ins — no extra dependencies.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Console-only diagnostics; no external reporting service.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-ink p-6">
          <div className="max-w-md w-full bg-surface border border-line rounded-float p-8 text-center space-y-4 shadow-sm">
            <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
            <p className="text-xs text-ink-3">
              The application hit an unexpected error. Your data has not been affected.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-[11px] font-mono text-bad bg-bad/8 border border-line rounded-ctl p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center h-9 px-4 rounded-ctl bg-accent text-accent-foreground text-sm font-medium transition-colors hover:brightness-110"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
