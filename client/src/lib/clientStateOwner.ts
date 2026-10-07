/**
 * Ties browser-persisted studio state to the account that created it.
 *
 * The project inbox (queued takes/notes) and the open cloud project live in
 * localStorage, which is per-browser, not per-user. On a shared computer, user
 * B signing in after user A would otherwise import A's queued takes (uploaded
 * vocal URLs included) into B's project and keep A's project "open" (security
 * review of the inbox commit, 2026-10-07). AuthProvider calls this whenever
 * auth settles: a different user, or signing out, clears that state.
 */
import { useProjectInbox } from '@/lib/projectInbox';
import { useStudioStore } from '@/stores/useStudioStore';
import { clearBoothTakes } from '@/components/studio/boothTakesStore';

const OWNER_KEY = 'codedswitch-client-state-owner';

export function bindClientStateToUser(userId: string | null): void {
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(OWNER_KEY);
  } catch {
    // storage unavailable — fall through and clear to be safe
  }

  if (previous !== userId) {
    useProjectInbox.setState({ items: [] });
    useStudioStore.getState().setCloudProject(null);
    clearBoothTakes();
  }

  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // ignore — state was already cleared above when ownership was unknown
  }
}
