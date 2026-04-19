import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ── Error types ──────────────────────────────────────────────────────────────

/** Structured API error that preserves server metadata. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errorCode?: string,
    public readonly retryAfter?: number,
    public readonly provider?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isRateLimited(): boolean { return this.status === 429; }
  get isServerError(): boolean { return this.status >= 500; }
  get isAuthError(): boolean { return this.status === 401; }

  /** Human-friendly message suitable for toast UI. */
  get userMessage(): string {
    if (this.isRateLimited) {
      const wait = this.retryAfter
        ? this.retryAfter > 60
          ? `${Math.ceil(this.retryAfter / 60)} minutes`
          : `${this.retryAfter} seconds`
        : 'a few minutes';
      return `Rate limit reached. Please wait ${wait} and try again.`;
    }
    if (this.isServerError) return 'Server error — please try again shortly.';
    if (this.isAuthError) return 'Please log in to continue.';
    return this.message;
  }
}

// ── Response parsing ─────────────────────────────────────────────────────────

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;

  const contentType = res.headers.get("content-type") || "";
  const retryAfter = res.headers.get("retry-after");
  const headerRequestId = res.headers.get("x-request-id") || undefined;

  // Try to parse JSON body for structured error info
  if (contentType.includes("application/json")) {
    try {
      const body = await res.json();
      throw new ApiError(
        res.status,
        String(body?.message || body?.error || body?.detail || res.statusText || "Request failed"),
        body?.error,
        retryAfter ? Number(retryAfter) : body?.retryAfter,
        body?.provider,
        body?.requestId || headerRequestId,
      );
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // JSON parse failed — fall through to text handling
    }
  }

  // HTML or plain text response — extract something useful
  const text = await res.text().catch(() => res.statusText);
  throw new ApiError(
    res.status,
    text?.substring(0, 200) || res.statusText,
    res.status === 429 ? 'RATE_LIMITED' : undefined,
    retryAfter ? Number(retryAfter) : undefined,
    undefined,
    headerRequestId,
  );
}

// ── Retry with exponential backoff ───────────────────────────────────────────

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Only retry these status codes. Default: [429, 502, 503, 504] */
  retryableStatuses?: number[];
  /** Caller-owned AbortSignal. Aborts the fetch AND interrupts any retry backoff. */
  signal?: AbortSignal;
}

const DEFAULT_RETRY: Required<Omit<RetryOptions, 'signal'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatuses: [429, 502, 503, 504],
};

async function fetchWithRetry(
  input: RequestInfo,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryableStatuses } = {
    ...DEFAULT_RETRY,
    ...opts,
  };
  const signal = opts.signal ?? init.signal ?? undefined;

  let lastError: ApiError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Caller aborted between retries — bail before firing the next request
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    try {
      const res = await fetch(input, { ...init, signal });

      if (res.ok) return res;

      // Non-retryable status — throw immediately
      if (!retryableStatuses.includes(res.status)) {
        await throwIfResNotOk(res);
        return res; // unreachable but satisfies TS
      }

      // Retryable status — parse error, then decide
      await throwIfResNotOk(res);
    } catch (err) {
      // Fetch itself was aborted — surface as AbortError, don't retry
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (!(err instanceof ApiError)) throw err;
      lastError = err;

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) break;

      // Don't retry auth errors
      if (err.isAuthError) throw err;

      // Only retry retryable statuses
      if (!retryableStatuses.includes(err.status)) throw err;

      // Calculate delay: honour Retry-After header, else exponential backoff + jitter
      let delayMs: number;
      if (err.retryAfter && err.retryAfter > 0) {
        // Retry-After is in seconds
        delayMs = Math.min(err.retryAfter * 1000, maxDelayMs);
      } else {
        delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        // Add jitter (±25%) to prevent thundering herd
        delayMs += delayMs * (Math.random() * 0.5 - 0.25);
      }

      console.warn(
        `[API] Retry ${attempt + 1}/${maxRetries} for ${typeof input === 'string' ? input : 'request'} ` +
        `after ${Math.round(delayMs)}ms (status ${err.status})`,
      );

      // Abort-aware sleep: bail early if caller cancels during backoff
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new DOMException('Request aborted', 'AbortError'));
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, delayMs);
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
  }

  // All retries exhausted
  throw lastError ?? new ApiError(0, 'Request failed after retries');
}

// ── Main API request function ────────────────────────────────────────────────

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  retryOpts?: RetryOptions,
): Promise<Response> {
  const headers: Record<string, string> = data
    ? { "Content-Type": "application/json" }
    : {};

  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: retryOpts?.signal,
  };

  // Use retry logic for mutations (POST/PUT/PATCH) to AI endpoints,
  // but not for idempotency-unsafe operations unless explicitly requested.
  // Note: passing a `signal` alone does NOT force retry mode — signal is a
  // transport concern (always respected), not a retry opt-in. Any *other*
  // RetryOptions field (maxRetries, baseDelayMs, maxDelayMs, retryableStatuses)
  // is treated as an explicit request to enable retry.
  const hasRetryConfig = retryOpts !== undefined &&
    Object.keys(retryOpts).some(k => k !== 'signal');
  const shouldRetry = hasRetryConfig ||
    (method === 'POST' && /\/(ai|grok|generate|astutely|chords|lyrics|melody|drums|bass|mix|mastering|arrangement|vocal-melody|stem-separation|chord-progression)/.test(url));

  if (shouldRetry) {
    return fetchWithRetry(url, init, retryOpts);
  }

  const res = await fetch(url, init);

  // For 429 on non-retry paths, still provide a good error
  await throwIfResNotOk(res);
  return res;
}

// ── TanStack Query integration ───────────────────────────────────────────────

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    // TanStack Query supplies an AbortSignal that fires when the query is
    // cancelled (component unmount, refetch, etc.) — wiring it here means
    // every useQuery automatically cancels its in-flight request.
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
      signal,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Auto-retry 429 and 5xx up to 2 times for queries
        if (error instanceof ApiError && [429, 502, 503, 504].includes(error.status)) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10_000),
    },
    mutations: {
      retry: false, // Mutations use fetchWithRetry internally
    },
  },
});
