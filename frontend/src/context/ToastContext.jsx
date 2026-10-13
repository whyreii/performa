import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from '../components/icons';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  // Mirror of the current list so addToast can collapse an identical message.
  const toastsRef = useRef([]);
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  // Clear any pending auto-dismiss timers on unmount.
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, options = {}) => {
    const type = options.type || 'info'; // 'success' | 'warning' | 'error' | 'info'
    const duration = options.duration !== undefined ? options.duration : 3500;

    // An identical toast already on screen: refresh its timer instead of
    // stacking a visual duplicate.
    const existing = toastsRef.current.find((t) => t.message === message && t.type === type);
    if (existing) {
      const prevTimer = timersRef.current.get(existing.id);
      if (prevTimer) clearTimeout(prevTimer);
      if (duration > 0) {
        timersRef.current.set(
          existing.id,
          setTimeout(() => removeToast(existing.id), duration)
        );
      }
      return existing.id;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast = {
      id,
      message,
      type,
      title: options.title || null,
      duration,
    };

    setToasts((prev) => [...prev.slice(-4), toast]); // Keep at most 5 toasts stacked

    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, toast.duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  const toast = useMemo(
    () => ({
      show: addToast,
      success: (message, options) => addToast(message, { ...options, type: 'success' }),
      error: (message, options) => addToast(message, { ...options, type: 'error' }),
      warning: (message, options) => addToast(message, { ...options, type: 'warning' }),
      info: (message, options) => addToast(message, { ...options, type: 'info' }),
      dismiss: removeToast,
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Render Viewport */}
      <aside
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const { type, message, title } = toast;

  const config = {
    success: {
      icon: CheckCircle2,
      iconColor: 'text-good',
      borderColor: 'border-good/30',
      badgeBg: 'bg-good/10',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-warn',
      borderColor: 'border-warn/30',
      badgeBg: 'bg-warn/10',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-bad',
      borderColor: 'border-bad/30',
      badgeBg: 'bg-bad/10',
    },
    info: {
      icon: Info,
      iconColor: 'text-accent',
      borderColor: 'border-accent/30',
      badgeBg: 'bg-accent/10',
    },
  }[type] || {
    icon: Info,
    iconColor: 'text-accent',
    borderColor: 'border-line',
    badgeBg: 'bg-surface',
  };

  const Icon = config.icon;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-field bg-surface/95 backdrop-blur-md border ${config.borderColor} shadow-pop animate-in slide-in-from-bottom-2 fade-in duration-200 transition-opacity`}
    >
      <div className={`p-1.5 rounded-ctl ${config.badgeBg} ${config.iconColor} shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 pr-1">
        {title && <p className="text-12 font-semibold text-ink leading-tight mb-0.5">{title}</p>}
        <p className="text-12 text-ink-2 leading-relaxed break-words">{message}</p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        className="p-1 text-ink-3 hover:text-ink rounded-ctl hover:bg-hover transition-colors shrink-0 -mr-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
