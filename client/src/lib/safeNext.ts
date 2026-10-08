/**
 * Where to send someone after they sign in or sign up: the `?next=` path they
 * came from, if it is a same-site path. Absolute URLs, protocol-relative
 * `//host` and backslash tricks are rejected — honouring them would make the
 * login page an open redirect. Auth pages themselves are never a destination.
 */
const AUTH_PAGES = ['/login', '/signup'];

export function safeNextPath(search: string, fallback: string): string {
  let next: string | null = null;
  try {
    next = new URLSearchParams(search).get('next');
  } catch {
    return fallback;
  }
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (AUTH_PAGES.some((p) => next === p || next!.startsWith(`${p}?`) || next!.startsWith(`${p}/`))) return fallback;
  return next;
}
