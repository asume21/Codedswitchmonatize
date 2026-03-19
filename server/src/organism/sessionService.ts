import { db } from "../../db";
import { sql } from "drizzle-orm";

export const sessionService = {
  async save(dna: {
    sessionId: string
    userId: string
    durationMs: number
    dominantMode: string
    avgPulse: number
    avgBounce: number
    avgSwing: number
    avgPresence: number
    avgDensity: number
    timeInFlowMs: number
    flowPercentage: number
    longestFlowStreak: number
    transitionCount: number
    cadenceLockEvents: number
    avgSyllabicDensity: number
    pitchCenter: number
    energyProfile: string
    [key: string]: unknown
  }) {
    // Round integer-typed columns — JS timers and accumulators produce floats
    const durationMs       = Math.round(dna.durationMs       || 0)
    const timeInFlowMs     = Math.round(dna.timeInFlowMs     || 0)
    const longestFlowStreak = Math.round(dna.longestFlowStreak || 0)
    const transitionCount  = Math.round(dna.transitionCount  || 0)
    const cadenceLockEvents = Math.round(dna.cadenceLockEvents || 0)
    const pitchCenter      = Math.round(dna.pitchCenter      || 0)

    const result = await db.execute(sql`
      INSERT INTO organism_sessions (
        session_id, user_id, duration_ms,
        dominant_mode, avg_pulse, avg_bounce, avg_swing,
        avg_presence, avg_density,
        time_in_flow_ms, flow_percentage, longest_flow_streak,
        transition_count, cadence_lock_events,
        avg_syllabic_density, pitch_center, energy_profile,
        session_dna
      ) VALUES (
        ${dna.sessionId}, ${dna.userId}, ${durationMs},
        ${dna.dominantMode}, ${dna.avgPulse}, ${dna.avgBounce}, ${dna.avgSwing},
        ${dna.avgPresence}, ${dna.avgDensity},
        ${timeInFlowMs}, ${dna.flowPercentage}, ${longestFlowStreak},
        ${transitionCount}, ${cadenceLockEvents},
        ${dna.avgSyllabicDensity}, ${pitchCenter}, ${dna.energyProfile},
        ${JSON.stringify(dna)}::jsonb
      )
      RETURNING id, session_id as "sessionId"
    `)
    return result[0] as { id: string; sessionId: string }
  },

  async listByUser(userId: string, limit = 50) {
    const rows = await db.execute(sql`
      SELECT
        id, session_id as "sessionId", created_at as "createdAt",
        dominant_mode as "dominantMode", avg_pulse as "avgPulse",
        flow_percentage as "flowPercentage", duration_ms as "durationMs",
        energy_profile as "energyProfile"
      FROM organism_sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)
    return rows
  },

  async getBySessionId(userId: string, sessionId: string) {
    const rows = await db.execute(sql`
      SELECT session_dna as "sessionDna"
      FROM organism_sessions
      WHERE user_id = ${userId} AND session_id = ${sessionId}
    `)
    if (!rows[0]) return null
    return (rows[0] as { sessionDna: unknown }).sessionDna
  },
}
