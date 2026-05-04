/**
 * Centralized logger for the ZeroSpam mobile app.
 *
 * In development: writes to the console with structured context.
 * In production:  silences debug/info; errors are kept so crash-reporting
 *                 tools (Sentry, etc.) can hook in later via `addTransport`.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogEntry = {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
};

type Transport = (entry: LogEntry) => void;

const transports: Transport[] = [];

/** Register an additional log transport (e.g. Sentry, Datadog). */
export function addTransport(fn: Transport): void {
  transports.push(fn);
}

const isDev = process.env.NODE_ENV !== 'production';

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };

  // Console output in development.
  if (isDev) {
    const prefix = `[ZS:${level.toUpperCase()}]`;
    const args: unknown[] = context ? [prefix, message, context] : [prefix, message];
    if (level === 'error') {
      console.error(...args);
    } else if (level === 'warn') {
      console.warn(...args);
    } else {
      console.log(...args);
    }
  } else if (level === 'error' || level === 'warn') {
    // In production keep errors/warnings visible for native crash logs.
    const prefix = `[ZS:${level.toUpperCase()}]`;
    const args: unknown[] = context ? [prefix, message, context] : [prefix, message];
    if (level === 'error') console.error(...args);
    else console.warn(...args);
  }

  for (const t of transports) {
    try {
      t(entry);
    } catch {
      // Never let a transport crash the app.
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info:  (message: string, context?: Record<string, unknown>) => emit('info',  message, context),
  warn:  (message: string, context?: Record<string, unknown>) => emit('warn',  message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
