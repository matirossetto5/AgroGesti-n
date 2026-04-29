import * as Sentry from '@sentry/react';

export function initializeSentry() {
  const isDev = import.meta.env.DEV;
  const isProduction = !isDev;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string;
  const mode = import.meta.env.MODE;

  if (isProduction && dsn) {
    Sentry.init({
      dsn,
      environment: mode,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
}

export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

export function trackEvent(name: string, properties?: Record<string, any>) {
  Sentry.captureMessage(`Event: ${name}`, 'info');
}
