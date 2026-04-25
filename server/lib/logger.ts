// Structured JSON logger for revenue-critical paths.
//
// Why this file exists:
//   `console.error("Stripe webhook error:", err)` produces a single string
//   with no field structure — log drains (Railway, Datadog, Sentry) can't
//   index it, alert on it, or correlate it. Every line emitted here is a
//   single JSON object on one line, which every log platform parses natively.
//
// Why no `pino` dep yet:
//   Adding a dep right now requires regenerating npm-shrinkwrap.json. This
//   module exposes a pino-shaped surface (`info`, `warn`, `error`, `fatal`,
//   `child`) so swapping to pino later is a one-file change.
//
// Sentry:
//   `captureError` dynamically imports `@sentry/node` *only if* SENTRY_DSN
//   is set. If the dep isn't installed, the import fails silently and we
//   fall back to logging — never blocking the request path.

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, fields: LogFields, msg: string) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  const record = {
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  };

  // Errors and fatals go to stderr so log drains can split severity streams.
  const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(record, errReplacer) + '\n');
}

// JSON.stringify drops Error fields (message/stack are non-enumerable).
// This replacer flattens them so stack traces actually land in the log.
function errReplacer(_key: string, value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value as unknown as Record<string, unknown>),
    };
  }
  return value;
}

export interface Logger {
  debug(fields: LogFields | string, msg?: string): void;
  info(fields: LogFields | string, msg?: string): void;
  warn(fields: LogFields | string, msg?: string): void;
  error(fields: LogFields | string, msg?: string): void;
  fatal(fields: LogFields | string, msg?: string): void;
  child(bindings: LogFields): Logger;
}

function makeLogger(bindings: LogFields = {}): Logger {
  const log = (level: LogLevel) => (fieldsOrMsg: LogFields | string, msg?: string) => {
    if (typeof fieldsOrMsg === 'string') {
      emit(level, bindings, fieldsOrMsg);
    } else {
      emit(level, { ...bindings, ...fieldsOrMsg }, msg ?? '');
    }
  };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    fatal: log('fatal'),
    child: (extra) => makeLogger({ ...bindings, ...extra }),
  };
}

export const logger = makeLogger({ service: 'codedswitch' });

let sentryReady: Promise<{ captureException: (e: unknown) => void } | null> | null = null;

async function getSentry() {
  if (!process.env.SENTRY_DSN) return null;
  if (!sentryReady) {
    sentryReady = (async () => {
      try {
        // @ts-expect-error — optional dep; resolved at runtime if installed.
        const Sentry = await import('@sentry/node');
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          tracesSampleRate: 0,
        });
        logger.info({ sentry: true }, 'Sentry initialised');
        return Sentry;
      } catch (err) {
        logger.warn({ err }, '@sentry/node not installed — error capture disabled');
        return null;
      }
    })();
  }
  return sentryReady;
}

// Use this for any error you want surfaced in alerting (Stripe failures,
// credit ledger anomalies, AI provider outages). It always logs; it sends
// to Sentry only when SENTRY_DSN is set AND the optional dep is installed.
export async function captureError(err: unknown, context: LogFields = {}) {
  logger.error({ ...context, err }, context.msg ? String(context.msg) : 'captured error');
  const sentry = await getSentry();
  if (sentry) {
    try {
      sentry.captureException(err);
    } catch {
      // Never let observability infra break the request path.
    }
  }
}
