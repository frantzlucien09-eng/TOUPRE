/**
 * Lightweight client error/ops logging.
 * Optional: set VITE_SENTRY_DSN — when set we flag readiness; wire @sentry/browser in deploy if needed.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? '';

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    context: context ?? {},
    app: 'toupre',
    version: import.meta.env.VITE_APP_VERSION ?? '1.0.0-beta.1',
  };
  if (level === 'error') console.error('[TOUPRE]', payload);
  else if (level === 'warn') console.warn('[TOUPRE]', payload);
  else console.info('[TOUPRE]', payload);
}

export const opsLog = {
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};

export function initClientMonitoring() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    opsLog.error(ev.message || 'window.error', {
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    opsLog.error('unhandledrejection', {
      reason: ev.reason instanceof Error ? ev.reason.message : String(ev.reason),
    });
  });
  opsLog.info('client_monitoring_ready', {
    sentryDsnConfigured: Boolean(SENTRY_DSN),
  });
}
