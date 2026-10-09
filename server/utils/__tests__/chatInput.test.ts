import { describe, it, expect } from 'vitest';
import { normalizeChatInput, MAX_CHAT_MESSAGES, MAX_CHAT_CHARS } from '../chatInput';

// Security review 2026-10-09: the chat cap could be bypassed by sending an
// empty `messages` list plus a huge `prompt`, and `{...m}` forwarded any
// client-supplied fields to the AI provider. Every path must be bounded and
// only role + content may pass.
describe('normalizeChatInput', () => {
  it('caps a huge prompt sent without messages', () => {
    const out = normalizeChatInput({ messages: [], prompt: 'x'.repeat(100_000) });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ role: 'user', content: 'x'.repeat(MAX_CHAT_CHARS) });
  });

  it('keeps only the last N messages, each capped', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ role: 'user', content: `m${i}`.padEnd(9000, '.') }));
    const out = normalizeChatInput({ messages: many });
    expect(out).toHaveLength(MAX_CHAT_MESSAGES);
    expect(out[0].content.startsWith('m30')).toBe(true);
    expect(out.every((m) => m.content.length <= MAX_CHAT_CHARS)).toBe(true);
  });

  it('passes only role and content, with known roles', () => {
    const out = normalizeChatInput({ messages: [
      { role: 'user', content: 'hi', tool_calls: [{ x: 1 }], name: 'evil' },
      { role: 'function', content: 'nope' },
      { role: 'assistant', content: { not: 'a string' } },
    ] });
    expect(out).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '[object Object]' },
    ]);
  });

  it('defaults to a greeting when nothing usable is sent', () => {
    expect(normalizeChatInput({})).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(normalizeChatInput(null)).toEqual([{ role: 'user', content: 'Hello' }]);
  });
});
