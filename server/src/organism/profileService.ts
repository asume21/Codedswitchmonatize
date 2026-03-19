import { db } from "../../db";
import { sql } from "drizzle-orm";

// Global averages — same as in client ProfileEngine.ts
const GLOBAL_AVG = {
  bounce: 0.45,
  swing: 0.57,
  presence: 0.35,
  density: 0.5,
  pulse: 95,
};

const MODES = ["heat", "ice", "smoke", "gravel", "glow"];
const FLAT_MODE_PCT = 1 / MODES.length;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export const profileService = {
  async getProfile(userId: string) {
    const rows = await db.execute(sql`
      SELECT
        user_id       as "userId",
        computed_at   as "computedAt",
        session_count as "sessionCount",
        bounce_bias   as "bounceBias",
        swing_bias    as "swingBias",
        pocket_bias   as "pocketBias",
        presence_bias as "presenceBias",
        density_bias  as "densityBias",
        pulse_bias    as "pulseBias",
        confidence,
        mode_bias     as "modeBias"
      FROM organism_profiles
      WHERE user_id = ${userId}
    `);
    if (!rows[0]) return null;
    const row = rows[0] as Record<string, unknown>;
    return {
      userId: row.userId as string,
      computedAt: new Date(row.computedAt as string).getTime(),
      sessionCount: Number(row.sessionCount),
      bounceBias: Number(row.bounceBias),
      swingBias: Number(row.swingBias),
      pocketBias: Number(row.pocketBias),
      presenceBias: Number(row.presenceBias),
      densityBias: Number(row.densityBias),
      pulseBias: Number(row.pulseBias),
      confidence: Number(row.confidence),
      modeBias:
        typeof row.modeBias === "string"
          ? JSON.parse(row.modeBias)
          : row.modeBias,
    };
  },

  async recompute(userId: string) {
    // 1. Fetch last 50 sessions
    const rows = await db.execute(sql`
      SELECT
        avg_pulse     as "avgPulse",
        avg_bounce    as "avgBounce",
        avg_swing     as "avgSwing",
        avg_presence  as "avgPresence",
        avg_density   as "avgDensity",
        session_dna->'modeDistribution' as "modeDistribution"
      FROM organism_sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    if (!rows.length) {
      return {
        userId,
        computedAt: Date.now(),
        sessionCount: 0,
        bounceBias: 0,
        swingBias: 0,
        pocketBias: 0,
        presenceBias: 0,
        densityBias: 0,
        pulseBias: 0,
        modeBias: Object.fromEntries(MODES.map((m) => [m, 0])),
        confidence: 0,
      };
    }

    // 2. Compute weighted profile (same algorithm as client ProfileEngine)
    const n = rows.length;
    const weights = rows.map((_: unknown, i: number) => i + 1);
    const weightSum = weights.reduce((a: number, b: number) => a + b, 0);
    const w = weights.map((wi: number) => wi / weightSum);

    const wavg = (getter: (s: Record<string, unknown>) => number) =>
      rows.reduce(
        (sum: number, s: unknown, i: number) =>
          sum + getter(s as Record<string, unknown>) * w[i],
        0
      );

    const avgBounce = wavg((s) => Number(s.avgBounce ?? 0));
    const avgSwing = wavg((s) => Number(s.avgSwing ?? 0));
    const avgPresence = wavg((s) => Number(s.avgPresence ?? 0));
    const avgDensity = wavg((s) => Number(s.avgDensity ?? 0));
    const avgPulse = wavg((s) => Number(s.avgPulse ?? 90));

    const bounceBias = clamp(avgBounce - GLOBAL_AVG.bounce, -0.3, 0.3);
    const swingBias = clamp(avgSwing - GLOBAL_AVG.swing, -0.1, 0.1);
    const presenceBias = clamp(avgPresence - GLOBAL_AVG.presence, -0.3, 0.3);
    const densityBias = clamp(avgDensity - GLOBAL_AVG.density, -0.3, 0.3);
    const pulseBias = clamp(avgPulse - GLOBAL_AVG.pulse, -15, 15);
    const pocketBias = clamp(presenceBias * 0.7, -0.3, 0.3);

    const modeFreq: Record<string, number> = {};
    for (const mode of MODES) modeFreq[mode] = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      let dist: Record<string, number> = {};
      if (typeof row.modeDistribution === "string") {
        try {
          dist = JSON.parse(row.modeDistribution);
        } catch {
          dist = {};
        }
      } else if (row.modeDistribution && typeof row.modeDistribution === "object") {
        dist = row.modeDistribution as Record<string, number>;
      }
      for (const mode of MODES) {
        modeFreq[mode] += (dist[mode] ?? 0) * w[i];
      }
    }

    const modeBias = Object.fromEntries(
      MODES.map((m) => [m, clamp(modeFreq[m] - FLAT_MODE_PCT, -0.2, 0.2)])
    );

    const confidence = Math.min(1, n / 20);
    const sessionCount = n;
    const computedAt = new Date().toISOString();

    // 3. UPSERT
    await db.execute(sql`
      INSERT INTO organism_profiles
        (user_id, computed_at, session_count,
         bounce_bias, swing_bias, pocket_bias,
         presence_bias, density_bias, pulse_bias,
         mode_bias, confidence)
      VALUES
        (${userId}, ${computedAt}, ${sessionCount},
         ${bounceBias}, ${swingBias}, ${pocketBias},
         ${presenceBias}, ${densityBias}, ${pulseBias},
         ${JSON.stringify(modeBias)}::jsonb, ${confidence})
      ON CONFLICT (user_id) DO UPDATE SET
        computed_at   = EXCLUDED.computed_at,
        session_count = EXCLUDED.session_count,
        bounce_bias   = EXCLUDED.bounce_bias,
        swing_bias    = EXCLUDED.swing_bias,
        pocket_bias   = EXCLUDED.pocket_bias,
        presence_bias = EXCLUDED.presence_bias,
        density_bias  = EXCLUDED.density_bias,
        pulse_bias    = EXCLUDED.pulse_bias,
        mode_bias     = EXCLUDED.mode_bias,
        confidence    = EXCLUDED.confidence
    `);

    return {
      userId,
      computedAt: Date.now(),
      sessionCount,
      bounceBias,
      swingBias,
      pocketBias,
      presenceBias,
      densityBias,
      pulseBias,
      modeBias,
      confidence,
    };
  },
};
