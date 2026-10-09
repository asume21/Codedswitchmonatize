/**
 * Share-card text for a public song page (/s/:id).
 *
 * Link scrapers (iMessage, X, Discord, Facebook) don't run JavaScript, so the
 * server must put the song's own title/description into the HTML. Before this,
 * every shared song showed the generic homepage card (product review S4).
 * Returns null for private/missing songs — those keep the generic card.
 */
const MAX_SONG_TITLE = 80;

export function songOgMeta(
  song: { name?: string | null; isPublic?: boolean | null } | undefined,
  artist: string | null | undefined,
): { title: string; description: string } | null {
  if (!song || !song.isPublic) return null;
  // Uploaded songs are often named after their file ("beat (1).wav").
  let name = (song.name ?? '').trim().replace(/\.(wav|mp3|m4a|aac|flac|ogg|webm|aiff?)$/i, '').trim() || 'Untitled song';
  if (name.length > MAX_SONG_TITLE) name = `${name.slice(0, MAX_SONG_TITLE - 1)}…`;
  const by = (artist ?? '').trim() || 'a CodedSwitch artist';
  return {
    title: `${name} — ${by} | CodedSwitch`,
    description: `Listen to "${name}" by ${by}. Made on CodedSwitch.`,
  };
}
