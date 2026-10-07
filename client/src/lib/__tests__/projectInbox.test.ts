import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectInbox, sendToProject } from '../projectInbox';

// The inbox is how MAKE / ASTUTELY / LIBRARY hand work to MIX while MIX is
// unmounted. Items must queue in order and stay until MIX imports them.
describe('projectInbox', () => {
  beforeEach(() => {
    useProjectInbox.setState({ items: [] });
  });

  it('queues sends in order with their payload intact', () => {
    sendToProject({ kind: 'audio', trackId: 't1', name: 'Take 1', audioUrl: '/a.webm', source: 'test' });
    sendToProject({ kind: 'notes', notes: [{ pitch: 60 }], bpm: 90, source: 'test' });

    const items = useProjectInbox.getState().items;
    expect(items.map((i) => i.kind)).toEqual(['audio', 'notes']);
    expect(items[0]).toMatchObject({ trackId: 't1', audioUrl: '/a.webm' });
    expect(new Set(items.map((i) => i.inboxId)).size).toBe(2);
  });

  it('removes only the imported items', () => {
    sendToProject({ kind: 'audio', trackId: 'a', name: 'A', audioUrl: '/a', source: 'test' });
    sendToProject({ kind: 'audio', trackId: 'b', name: 'B', audioUrl: '/b', source: 'test' });
    const [first] = useProjectInbox.getState().items;

    useProjectInbox.getState().remove([first.inboxId]);

    expect(useProjectInbox.getState().items.map((i) => (i as any).trackId)).toEqual(['b']);
  });
});
