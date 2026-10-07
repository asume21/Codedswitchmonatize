// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { bindClientStateToUser } from '../clientStateOwner';
import { useProjectInbox, sendToProject } from '../projectInbox';
import { useStudioStore } from '@/stores/useStudioStore';

// Security review 2026-10-07: the project inbox and the open cloud project are
// persisted in the browser. On a shared computer, user B signing in after
// user A must NOT import A's queued takes or keep A's project open.
describe('bindClientStateToUser', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectInbox.setState({ items: [] });
    useStudioStore.setState({ cloudProject: null } as any);
  });

  function seedForUserA() {
    bindClientStateToUser('user-a');
    sendToProject({ kind: 'audio', trackId: 't', name: "A's take", audioUrl: '/a.webm', source: 'test' });
    useStudioStore.getState().setCloudProject({ id: 'proj-a', name: "A's song" });
  }

  it('keeps state when the same user comes back', () => {
    seedForUserA();
    bindClientStateToUser('user-a');
    expect(useProjectInbox.getState().items).toHaveLength(1);
    expect(useStudioStore.getState().cloudProject?.id).toBe('proj-a');
  });

  it("clears A's queued items and open project when B signs in", () => {
    seedForUserA();
    bindClientStateToUser('user-b');
    expect(useProjectInbox.getState().items).toHaveLength(0);
    expect(useStudioStore.getState().cloudProject).toBeNull();
  });

  it('clears on sign-out', () => {
    seedForUserA();
    bindClientStateToUser(null);
    expect(useProjectInbox.getState().items).toHaveLength(0);
    expect(useStudioStore.getState().cloudProject).toBeNull();
  });
});
