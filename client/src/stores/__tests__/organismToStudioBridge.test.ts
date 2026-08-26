// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { bridgeOrganismToStore } from "../organismToStudioBridge";
import { useStudioStore } from "../useStudioStore";

/**
 * Regression: eventsToStudioNotes computed `sessionStartMs = noteOns[0].timestamp`
 * INSIDE itself, and it is called once per generator — so every role was
 * normalised to its OWN first note. Drums entering at bar 1 and a melody
 * entering at bar 9 both landed on step 0, and the band arrived in the editor
 * out of sync with itself. The session start has to be shared across roles.
 */
const BPM = 120;                 // 120bpm -> a 16th note is 125ms
const T0 = 1_000_000;

function noteOn(generator: any, pitch: number, atMs: number) {
  return { frameIndex: 0, timestamp: T0 + atMs, generator, eventType: 'note_on' as const, pitch, velocity: 100, durationMs: 125 };
}

beforeEach(() => {
  useStudioStore.setState({ organismSnapshots: [] } as any);
});

describe("bridgeOrganismToStore — role alignment", () => {
  it("keeps roles on a shared timeline when one enters late", () => {
    const events = [
      noteOn('drum', 36, 0),        // drums at step 0
      noteOn('drum', 36, 500),      // step 4
      noteOn('melody', 72, 2000),   // melody enters 2s later => step 16
    ];
    const snap = bridgeOrganismToStore(events as any, BPM);

    expect(snap.tracks.drum.map(n => n.step)).toEqual([0, 4]);
    // The melody must NOT be pulled back to 0 just because it is that role's
    // first note — it entered a full bar later and has to stay there.
    expect(snap.tracks.melody[0].step).toBe(16);
  });

  it("still starts the earliest role at step 0", () => {
    const snap = bridgeOrganismToStore(
      [noteOn('bass', 40, 0), noteOn('chord', 60, 250)] as any, BPM,
    );
    expect(snap.tracks.bass[0].step).toBe(0);
    expect(snap.tracks.chord[0].step).toBe(2);
  });

  it("handles a single role with no other events", () => {
    const snap = bridgeOrganismToStore([noteOn('melody', 64, 0)] as any, BPM);
    expect(snap.tracks.melody[0].step).toBe(0);
  });

  it("returns empty tracks for roles that produced nothing", () => {
    const snap = bridgeOrganismToStore([noteOn('drum', 36, 0)] as any, BPM);
    expect(snap.tracks.melody).toEqual([]);
    expect(snap.tracks.texture).toEqual([]);
  });
});
