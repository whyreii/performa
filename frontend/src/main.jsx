import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Global diagnostic traps — console only (no external reporting service).
window.addEventListener('error', (event) => {
  console.error(
    '[window.error]',
    event.message,
    `${event.filename}:${event.lineno}:${event.colno}`,
    event.error
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
