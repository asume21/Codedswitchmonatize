# scripts/organism/compute_profiles.py
# Run: python scripts/organism/compute_profiles.py
# Requires: psycopg2, python-dotenv
# Idempotent — safe to run multiple times.
# Needs DATABASE_URL in your .env file.

import os
import json
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ['DATABASE_URL']

GLOBAL_AVG = {
    'bounce':   0.45,
    'swing':    0.57,
    'presence': 0.35,
    'density':  0.50,
    'pulse':    95.0,
}

MODES = ['heat', 'ice', 'smoke', 'gravel', 'glow']
FLAT_MODE_PCT = 1.0 / len(MODES)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def compute_profile(user_id: str, sessions: list) -> dict:
    """Pure Python port of ProfileEngine.computeProfile()"""
    n = len(sessions)
    if n == 0:
        return None

    weights = [(i + 1) for i in range(n)]
    w_sum   = sum(weights)
    w       = [wi / w_sum for wi in weights]

    def wavg(getter):
        return sum(getter(s) * w[i] for i, s in enumerate(sessions))

    avg_bounce   = wavg(lambda s: s.get('avg_bounce',   0))
    avg_swing    = wavg(lambda s: s.get('avg_swing',    0))
    avg_presence = wavg(lambda s: s.get('avg_presence', 0))
    avg_density  = wavg(lambda s: s.get('avg_density',  0))
    avg_pulse    = wavg(lambda s: s.get('avg_pulse',    90))

    bounce_bias   = clamp(avg_bounce   - GLOBAL_AVG['bounce'],   -0.3,  0.3)
    swing_bias    = clamp(avg_swing    - GLOBAL_AVG['swing'],    -0.1,  0.1)
    presence_bias = clamp(avg_presence - GLOBAL_AVG['presence'], -0.3,  0.3)
    density_bias  = clamp(avg_density  - GLOBAL_AVG['density'],  -0.3,  0.3)
    pulse_bias    = clamp(avg_pulse    - GLOBAL_AVG['pulse'],    -15.0, 15.0)
    pocket_bias   = clamp(presence_bias * 0.7, -0.3, 0.3)

    mode_freq = {m: 0.0 for m in MODES}
    for i, s in enumerate(sessions):
        dist = s.get('mode_distribution', {}) or {}
        for mode in MODES:
            mode_freq[mode] += dist.get(mode, 0) * w[i]

    mode_bias = {
        m: clamp(mode_freq[m] - FLAT_MODE_PCT, -0.2, 0.2)
        for m in MODES
    }

    confidence = min(1.0, n / 20.0)

    return {
        'user_id':       user_id,
        'computed_at':   datetime.utcnow().isoformat(),
        'session_count': n,
        'bounce_bias':   round(bounce_bias,   4),
        'swing_bias':    round(swing_bias,    4),
        'pocket_bias':   round(pocket_bias,   4),
        'presence_bias': round(presence_bias, 4),
        'density_bias':  round(density_bias,  4),
        'pulse_bias':    round(pulse_bias,    2),
        'mode_bias':     mode_bias,
        'confidence':    round(confidence, 3),
    }


def run():
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()

    # Find users with new sessions since last profile computation
    cur.execute("""
        SELECT DISTINCT s.user_id
        FROM organism_sessions s
        LEFT JOIN organism_profiles p ON p.user_id = s.user_id
        WHERE p.user_id IS NULL
           OR s.created_at > p.computed_at
    """)
    user_ids = [row[0] for row in cur.fetchall()]
    print(f'Recomputing profiles for {len(user_ids)} users...')

    for user_id in user_ids:
        cur.execute("""
            SELECT
              avg_pulse, avg_bounce, avg_swing,
              avg_presence, avg_density,
              session_dna->>'modeDistribution' as mode_distribution
            FROM organism_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_id,))

        rows = cur.fetchall()
        sessions = []
        for row in rows:
            try:
                mode_dist = json.loads(row[5]) if row[5] else {}
            except Exception:
                mode_dist = {}
            sessions.append({
                'avg_pulse':    float(row[0] or 90),
                'avg_bounce':   float(row[1] or 0),
                'avg_swing':    float(row[2] or 0.5),
                'avg_presence': float(row[3] or 0),
                'avg_density':  float(row[4] or 0),
                'mode_distribution': mode_dist,
            })

        profile = compute_profile(user_id, sessions)
        if not profile:
            continue

        cur.execute("""
            INSERT INTO organism_profiles
              (user_id, computed_at, session_count,
               bounce_bias, swing_bias, pocket_bias,
               presence_bias, density_bias, pulse_bias,
               mode_bias, confidence)
            VALUES
              (%(user_id)s, %(computed_at)s, %(session_count)s,
               %(bounce_bias)s, %(swing_bias)s, %(pocket_bias)s,
               %(presence_bias)s, %(density_bias)s, %(pulse_bias)s,
               %(mode_bias)s, %(confidence)s)
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
        """, {**profile, 'mode_bias': json.dumps(profile['mode_bias'])})

        print(f'  ✓ {user_id} — {profile["session_count"]} sessions, '
              f'confidence {profile["confidence"]:.2f}')

    conn.commit()
    cur.close()
    conn.close()
    print('Done.')


if __name__ == '__main__':
    run()
