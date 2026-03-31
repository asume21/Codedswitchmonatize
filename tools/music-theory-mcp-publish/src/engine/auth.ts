/**
 * API key gating for Music Theory MCP.
 *
 * Free tier tools run without a key.
 * Pro tier tools require a valid CODEDSWITCH_API_KEY.
 *
 * Key validation is done once per server session via codedswitch.com,
 * then cached for the remainder of the process lifetime.
 */

const API_KEY = process.env.CODEDSWITCH_API_KEY || '';
const VALIDATE_URL = 'https://www.codedswitch.com/api/mcp/validate-key';

// ─── Tier definitions ───────────────────────────────────────────────────────

export type ToolTier = 'free' | 'pro';

/** Which tools are free vs pro */
export const TOOL_TIERS: Record<string, ToolTier> = {
  // Free — basic lookups, always available
  get_scale:        'free',
  get_chord:        'free',
  transpose_note:   'free',
  get_interval:     'free',

  // Pro — composition intelligence, requires key
  identify_chord:        'pro',
  detect_key:            'pro',
  resolve_progression:   'pro',
  suggest_next_chord:    'pro',
  get_diatonic_chords:   'pro',
  get_genre_profile:     'pro',
  suggest_genre:         'pro',
  get_genre_rhythms:     'pro',
  transpose_progression: 'pro',
};

// ─── Cached validation ──────────────────────────────────────────────────────

interface KeyStatus {
  valid: boolean;
  tier: 'free' | 'pro' | 'enterprise';
  callsRemaining: number | null;
  message?: string;
}

let cachedStatus: KeyStatus | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function validateKey(): Promise<KeyStatus> {
  // No key → free tier
  if (!API_KEY) {
    return { valid: false, tier: 'free', callsRemaining: null, message: 'No API key set' };
  }

  // Return cached result if fresh
  const now = Date.now();
  if (cachedStatus && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedStatus;
  }

  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ product: 'music-theory-mcp' }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json() as any;
      cachedStatus = {
        valid: true,
        tier: data.tier ?? 'pro',
        callsRemaining: data.callsRemaining ?? null,
      };
    } else if (res.status === 401 || res.status === 403) {
      cachedStatus = {
        valid: false,
        tier: 'free',
        callsRemaining: null,
        message: 'Invalid API key',
      };
    } else {
      // Server error — be generous, allow pro access temporarily
      cachedStatus = { valid: true, tier: 'pro', callsRemaining: null };
    }
  } catch {
    // Network error — be generous, allow pro if key is present
    // This prevents offline devs from being locked out
    cachedStatus = {
      valid: !!API_KEY,
      tier: API_KEY ? 'pro' : 'free',
      callsRemaining: null,
      message: 'Could not reach validation server — running in offline mode',
    };
  }

  cacheTimestamp = now;
  return cachedStatus!;
}

// ─── Gate function ──────────────────────────────────────────────────────────

const PRO_GATE_ERROR = {
  content: [{
    type: 'text' as const,
    text: [
      '🔒 This is a Pro tool. Get a free API key to unlock it:',
      '',
      '1. Sign up at https://www.codedswitch.com/developer',
      '2. Copy your CODEDSWITCH_API_KEY',
      '3. Add it to your MCP config:',
      '',
      '   Claude Code (.mcp.json):',
      '   {',
      '     "mcpServers": {',
      '       "music-theory": {',
      '         "command": "npx",',
      '         "args": ["music-theory-mcp"],',
      '         "env": { "CODEDSWITCH_API_KEY": "csk_your_key_here" }',
      '       }',
      '     }',
      '   }',
      '',
      'Free tier includes: get_scale, get_chord, transpose_note, get_interval',
      'Pro tier adds: detect_key, identify_chord, suggest_next_chord, resolve_progression,',
      '  get_diatonic_chords, get_genre_profile, suggest_genre, get_genre_rhythms,',
      '  transpose_progression',
      '',
      'Free keys get 50 pro calls/day. Unlimited plans at codedswitch.com/pricing',
    ].join('\n'),
  }],
  isError: true,
};

/**
 * Wrap a tool handler with tier gating.
 * Free tools pass through immediately.
 * Pro tools validate the API key first.
 */
export function gated<T>(
  toolName: string,
  handler: (args: T) => Promise<any>,
): (args: T) => Promise<any> {
  const tier = TOOL_TIERS[toolName] ?? 'pro';

  if (tier === 'free') {
    return handler; // No gating
  }

  return async (args: T) => {
    const status = await validateKey();
    if (!status.valid) {
      return PRO_GATE_ERROR;
    }

    // Track usage (log for the user's awareness)
    if (status.callsRemaining !== null && status.callsRemaining <= 5) {
      const result = await handler(args);
      // Append warning to result
      if (result.content && Array.isArray(result.content)) {
        result.content.push({
          type: 'text' as const,
          text: `\n⚠️ ${status.callsRemaining} pro calls remaining today. Upgrade at codedswitch.com/pricing`,
        });
      }
      return result;
    }

    return handler(args);
  };
}
