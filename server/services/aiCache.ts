import crypto from 'crypto';

interface CacheEntry {
  response: any;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  savedCalls: number;
}

class AIResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, entries: 0, savedCalls: 0 };
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 1000, ttlMinutes: number = 60) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMinutes * 60 * 1000;
    
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private generateKey(endpoint: string, params: any): string {
    const normalizedParams = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('md5').update(`${endpoint}:${normalizedParams}`).digest('hex');
    return hash;
  }

  get(endpoint: string, params: any): any | null {
    const key = this.generateKey(endpoint, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.entries = this.cache.size;
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    this.stats.savedCalls++;
    console.log(`AI Cache HIT: ${endpoint} (saved ${entry.hits} API calls)`);
    return entry.response;
  }

  set(endpoint: string, params: any, response: any): void {
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(endpoint, params);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hits: 0
    });
    this.stats.entries = this.cache.size;
    console.log(`AI Cache SET: ${endpoint} (${this.cache.size} entries)`);
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.entries = this.cache.size;
      console.log(`AI Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  getStats(): CacheStats & { hitRate: string; estimatedSavings: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : '0.0';
    const estimatedSavings = `$${(this.stats.savedCalls * 0.002).toFixed(4)}`;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      estimatedSavings
    };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, entries: 0, savedCalls: 0 };
    console.log('AI Cache cleared');
  }
}

export const aiCache = new AIResponseCache(1000, 60);

export function withCache<T>(
  endpoint: string,
  params: any,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = aiCache.get(endpoint, params);
  if (cached) {
    return Promise.resolve(cached as T);
  }

  return fetchFn().then(response => {
    aiCache.set(endpoint, params, response);
    return response;
  });
}
