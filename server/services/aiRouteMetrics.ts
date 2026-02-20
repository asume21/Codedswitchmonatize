type RouteKey = '/api/astutely' | '/api/astutely/generate-audio' | '/api/music/generate-complete' | string;

type OutcomeKey = 'success' | 'error' | 'fallback';

export interface AIGenerationMetricEvent {
  route: RouteKey;
  requestedProvider?: string | null;
  effectiveProvider?: string | null;
  outcome: OutcomeKey;
  latencyMs: number;
}

interface RouteAggregate {
  total: number;
  success: number;
  error: number;
  fallback: number;
  latencyTotalMs: number;
  latencyMaxMs: number;
  byRequestedProvider: Record<string, number>;
  byEffectiveProvider: Record<string, number>;
}

interface MetricsState {
  startedAt: string;
  routes: Record<string, RouteAggregate>;
  totals: RouteAggregate;
}

const emptyAggregate = (): RouteAggregate => ({
  total: 0,
  success: 0,
  error: 0,
  fallback: 0,
  latencyTotalMs: 0,
  latencyMaxMs: 0,
  byRequestedProvider: {},
  byEffectiveProvider: {},
});

const state: MetricsState = {
  startedAt: new Date().toISOString(),
  routes: {},
  totals: emptyAggregate(),
};

const safeBucket = (value?: string | null) => {
  const normalized = String(value || 'unspecified').trim().toLowerCase();
  return normalized.length > 0 ? normalized : 'unspecified';
};

const applyEvent = (target: RouteAggregate, event: AIGenerationMetricEvent) => {
  target.total += 1;
  if (event.outcome === 'success') target.success += 1;
  if (event.outcome === 'error') target.error += 1;
  if (event.outcome === 'fallback') target.fallback += 1;

  const safeLatency = Math.max(0, Number(event.latencyMs) || 0);
  target.latencyTotalMs += safeLatency;
  target.latencyMaxMs = Math.max(target.latencyMaxMs, safeLatency);

  const requestedKey = safeBucket(event.requestedProvider);
  const effectiveKey = safeBucket(event.effectiveProvider);
  target.byRequestedProvider[requestedKey] = (target.byRequestedProvider[requestedKey] || 0) + 1;
  target.byEffectiveProvider[effectiveKey] = (target.byEffectiveProvider[effectiveKey] || 0) + 1;
};

export function recordAIGenerationMetric(event: AIGenerationMetricEvent) {
  const route = String(event.route || 'unknown');
  if (!state.routes[route]) {
    state.routes[route] = emptyAggregate();
  }

  applyEvent(state.routes[route], event);
  applyEvent(state.totals, event);
}

const withDerived = (aggregate: RouteAggregate) => ({
  ...aggregate,
  averageLatencyMs: aggregate.total > 0
    ? Number((aggregate.latencyTotalMs / aggregate.total).toFixed(2))
    : 0,
  errorRate: aggregate.total > 0
    ? Number((aggregate.error / aggregate.total).toFixed(4))
    : 0,
  fallbackRate: aggregate.total > 0
    ? Number((aggregate.fallback / aggregate.total).toFixed(4))
    : 0,
});

export function getAIGenerationMetricsSnapshot() {
  const routes: Record<string, ReturnType<typeof withDerived>> = {};
  Object.entries(state.routes).forEach(([key, value]) => {
    routes[key] = withDerived(value);
  });

  return {
    startedAt: state.startedAt,
    totals: withDerived(state.totals),
    routes,
  };
}

export function resetAIGenerationMetrics() {
  state.startedAt = new Date().toISOString();
  state.routes = {};
  state.totals = emptyAggregate();
}
