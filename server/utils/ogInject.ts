/**
 * Put page-specific share metadata (title, description, canonical URL, image)
 * into the built index.html for link scrapers, which don't run JavaScript.
 *
 * Values can be user-controlled (song names, usernames), so they are
 * HTML-escaped AND inserted with function replacements: in a replacement
 * *string*, String.replace treats `$&`, `` $` ``, `$'` and `$1` as patterns that
 * splice parts of the page back in — a song titled `$'` would have injected
 * HTML (security review, 2026-10-09).
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function injectOgMeta(
  html: string,
  url: string,
  image: string,
  o: { title: string; description: string },
): string {
  const t = esc(o.title);
  const d = esc(o.description);
  const u = esc(url);
  const i = esc(image);
  const set = (pattern: RegExp, value: string) => (src: string) =>
    src.replace(pattern, (_m, open: string, close: string) => `${open}${value}${close}`);
  return [
    set(/(<title>)[\s\S]*?(<\/title>)/, t),
    set(/(<link rel="canonical" href=")[^"]*(")/, u),
    set(/(<meta name="description" content=")[^"]*(")/, d),
    set(/(<meta property="og:title" content=")[^"]*(")/, t),
    set(/(<meta property="og:description" content=")[^"]*(")/, d),
    set(/(<meta property="og:url" content=")[^"]*(")/, u),
    set(/(<meta property="og:image" content=")[^"]*(")/, i),
    set(/(<meta name="twitter:title" content=")[^"]*(")/, t),
    set(/(<meta name="twitter:description" content=")[^"]*(")/, d),
    set(/(<meta name="twitter:url" content=")[^"]*(")/, u),
    set(/(<meta name="twitter:image" content=")[^"]*(")/, i),
  ].reduce((src, apply) => apply(src), html);
}
