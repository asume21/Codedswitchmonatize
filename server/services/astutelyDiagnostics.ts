// server/services/astutelyDiagnostics.ts
// Astutely self-diagnostic system — tracks every generation attempt, failure,
// and warning so the user can see exactly what's happening under the hood.

export type DiagnosticSeverity = 'info' | 'warn' | 'error' | 'critical';

export type DiagnosticCategory =
  | 'local_ai_call'
  | 'cloud_ai_call'
  | 'json_parse'
  | 'validation'
  | 'fallback_used'
  | 'endpoint_miss'
  | 'audio_generation'
  | 'provider_health'
  | 'rate_limit'
  | 'general';

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  style?: string;
  provider?: string;
  durationMs?: number;
  rawAIResponse?: string;
  validationErrors?: string[];
  validationWarnings?: string[];
  resolution?: string;
}

export interface DiagnosticSummary {
  totalGenerations: number;
  successCount: number;
  fallbackCount: number;
  errorCount: number;
  avgLatencyMs: number;
  lastError: DiagnosticEvent | null;
  localAISuccessRate: number;
  cloudAISuccessRate: number;
  topErrors: { message: string; count: number }[];
  uptime: number;
  recentEvents: DiagnosticEvent[];
}

const MAX_EVENTS = 200;
const MAX_RAW_RESPONSE_LENGTH = 2000;

class AstutelyDiagnostics {
  private events: DiagnosticEvent[] = [];
  private startTime = Date.now();
  private counters = {
    totalGenerations: 0,
    successes: 0,
    fallbacks: 0,
    errors: 0,
    localAIAttempts: 0,
    localAISuccesses: 0,
    cloudAIAttempts: 0,
    cloudAISuccesses: 0,
    totalLatencyMs: 0,
  };
  private errorFrequency: Map<string, number> = new Map();

  private nextId(): string {
    return `diag-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  log(event: Omit<DiagnosticEvent, 'id' | 'timestamp'>): DiagnosticEvent {
    const full: DiagnosticEvent = {
      ...event,
      id: this.nextId(),
      timestamp: Date.now(),
      rawAIResponse: event.rawAIResponse
        ? event.rawAIResponse.slice(0, MAX_RAW_RESPONSE_LENGTH)
        : undefined,
    };

    this.events.push(full);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    if (full.severity === 'error' || full.severity === 'critical') {
      const key = `${full.category}:${full.message.slice(0, 80)}`;
      this.errorFrequency.set(key, (this.errorFrequency.get(key) || 0) + 1);
    }

    const prefix =
      full.severity === 'critical' ? '🔴' :
      full.severity === 'error' ? '🟠' :
      full.severity === 'warn' ? '🟡' : '🟢';
    console.log(`[Astutely Diag] ${prefix} [${full.category}] ${full.message}`);

    return full;
  }

  recordGeneration(opts: {
    requestId: string;
    style: string;
    provider: string;
    durationMs: number;
    usedFallback: boolean;
    warnings?: string[];
    validationErrors?: string[];
  }) {
    this.counters.totalGenerations++;
    this.counters.totalLatencyMs += opts.durationMs;

    if (opts.usedFallback) {
      this.counters.fallbacks++;
      this.log({
        severity: 'warn',
        category: 'fallback_used',
        message: `Generation fell back to template patterns for "${opts.style}"`,
        requestId: opts.requestId,
        style: opts.style,
        provider: opts.provider,
        durationMs: opts.durationMs,
        validationErrors: opts.validationErrors,
        validationWarnings: opts.warnings,
        resolution: 'Used fallback pattern generator',
      });
    } else {
      this.counters.successes++;
      this.log({
        severity: 'info',
        category: 'general',
        message: `Successfully generated "${opts.style}" via ${opts.provider}`,
        requestId: opts.requestId,
        style: opts.style,
        provider: opts.provider,
        durationMs: opts.durationMs,
        validationWarnings: opts.warnings,
      });
    }
  }

  recordLocalAIAttempt(success: boolean, opts?: {
    requestId?: string;
    error?: string;
    rawResponse?: string;
    durationMs?: number;
  }) {
    this.counters.localAIAttempts++;
    if (success) {
      this.counters.localAISuccesses++;
    } else {
      this.log({
        severity: 'error',
        category: 'local_ai_call',
        message: `Local AI (Phi3) failed: ${opts?.error || 'Unknown error'}`,
        requestId: opts?.requestId,
        provider: 'Phi3 (Local)',
        durationMs: opts?.durationMs,
        rawAIResponse: opts?.rawResponse,
        resolution: 'Falling back to cloud AI or template',
      });
    }
  }

  recordCloudAIAttempt(success: boolean, opts?: {
    requestId?: string;
    error?: string;
    rawResponse?: string;
    durationMs?: number;
  }) {
    this.counters.cloudAIAttempts++;
    if (success) {
      this.counters.cloudAISuccesses++;
    } else {
      this.log({
        severity: 'error',
        category: 'cloud_ai_call',
        message: `Cloud AI (Grok) failed: ${opts?.error || 'Unknown error'}`,
        requestId: opts?.requestId,
        provider: 'Grok-3 (Cloud)',
        durationMs: opts?.durationMs,
        rawAIResponse: opts?.rawResponse,
        resolution: 'Falling back to template',
      });
    }
  }

  recordJSONParseError(opts: {
    requestId?: string;
    rawResponse: string;
    error: string;
    provider: string;
  }) {
    this.counters.errors++;
    this.log({
      severity: 'error',
      category: 'json_parse',
      message: `JSON parse failed from ${opts.provider}: ${opts.error}`,
      requestId: opts.requestId,
      provider: opts.provider,
      rawAIResponse: opts.rawResponse,
      resolution: 'Attempting JSON extraction / falling back',
    });
  }

  recordValidationFailure(opts: {
    requestId?: string;
    errors: string[];
    warnings: string[];
    provider: string;
    style?: string;
  }) {
    this.log({
      severity: 'warn',
      category: 'validation',
      message: `Validation failed (${opts.errors.length} errors): ${opts.errors.slice(0, 3).join('; ')}`,
      requestId: opts.requestId,
      provider: opts.provider,
      style: opts.style,
      validationErrors: opts.errors,
      validationWarnings: opts.warnings,
    });
  }

  recordEndpointMiss(opts: {
    endpoint: string;
    error: string;
    requestId?: string;
  }) {
    this.counters.errors++;
    this.log({
      severity: 'critical',
      category: 'endpoint_miss',
      message: `Endpoint failed: ${opts.endpoint} — ${opts.error}`,
      requestId: opts.requestId,
      details: { endpoint: opts.endpoint },
    });
  }

  getSummary(limit = 50): DiagnosticSummary {
    const lastError = [...this.events]
      .reverse()
      .find(e => e.severity === 'error' || e.severity === 'critical') || null;

    const topErrors = [...this.errorFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    const localRate = this.counters.localAIAttempts > 0
      ? this.counters.localAISuccesses / this.counters.localAIAttempts
      : 0;
    const cloudRate = this.counters.cloudAIAttempts > 0
      ? this.counters.cloudAISuccesses / this.counters.cloudAIAttempts
      : 0;
    const avgLatency = this.counters.totalGenerations > 0
      ? Math.round(this.counters.totalLatencyMs / this.counters.totalGenerations)
      : 0;

    return {
      totalGenerations: this.counters.totalGenerations,
      successCount: this.counters.successes,
      fallbackCount: this.counters.fallbacks,
      errorCount: this.counters.errors,
      avgLatencyMs: avgLatency,
      lastError,
      localAISuccessRate: Math.round(localRate * 100),
      cloudAISuccessRate: Math.round(cloudRate * 100),
      topErrors,
      uptime: Date.now() - this.startTime,
      recentEvents: this.events.slice(-limit).reverse(),
    };
  }

  getRecentErrors(limit = 20): DiagnosticEvent[] {
    return this.events
      .filter(e => e.severity === 'error' || e.severity === 'critical')
      .slice(-limit)
      .reverse();
  }

  clear() {
    this.events = [];
    this.errorFrequency.clear();
    this.counters = {
      totalGenerations: 0,
      successes: 0,
      fallbacks: 0,
      errors: 0,
      localAIAttempts: 0,
      localAISuccesses: 0,
      cloudAIAttempts: 0,
      cloudAISuccesses: 0,
      totalLatencyMs: 0,
    };
  }
}

export const astutelyDiagnostics = new AstutelyDiagnostics();
