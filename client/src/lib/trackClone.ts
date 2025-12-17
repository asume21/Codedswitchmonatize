type NoteLike = { id?: string } & Record<string, any>;

export type TrackLike = {
  id: string;
  name: string;
  notes?: NoteLike[];
  payload?: Record<string, any>;
} & Record<string, any>;

const makeId = (prefix = "track") =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Safely duplicate a track and its note data without sharing references.
 * Also updates payload.notes when present so consumers don't point at stale arrays.
 */
export function duplicateTrackData<T extends TrackLike>(track: T, suffix = "(Copy)"): T {
  const newId = makeId();
  const clonedNotes = Array.isArray(track.notes)
    ? track.notes.map((note, idx) => ({
        ...note,
        id: `${note.id ?? "note"}-${newId}-${idx}`,
      }))
    : track.notes;

  const payload =
    track.payload !== undefined
      ? {
          ...track.payload,
          notes: clonedNotes,
        }
      : undefined;

  return {
    ...track,
    id: newId,
    name: `${track.name} ${suffix}`.trim(),
    notes: clonedNotes,
    ...(payload ? { payload } : {}),
  };
}
