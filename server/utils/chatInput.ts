/**
 * Bound and sanitise what a chat request may send to the AI provider.
 *
 * Every path into the model is capped — `messages` AND the `prompt` fallback
 * (the first cap missed `prompt`, so an empty `messages` plus a huge prompt
 * bypassed it — security review 2026-10-09). Only `role` and `content` pass,
 * and only for known roles: spreading the client's object forwarded arbitrary
 * fields (tool_calls, name, …) to the provider.
 */
export const MAX_CHAT_MESSAGES = 20;
export const MAX_CHAT_CHARS = 4000;

type Role = 'system' | 'user' | 'assistant';
const ROLES = new Set<Role>(['system', 'user', 'assistant']);

export function normalizeChatInput(body: unknown): Array<{ role: Role; content: string }> {
  const b = (body && typeof body === 'object' ? body : {}) as { messages?: unknown; prompt?: unknown };
  const raw = Array.isArray(b.messages) ? b.messages : [];
  const messages = raw
    .filter((m): m is { role: Role; content: unknown } =>
      !!m && typeof m === 'object' && ROLES.has((m as { role?: Role }).role as Role))
    .slice(-MAX_CHAT_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, MAX_CHAT_CHARS) }));
  if (messages.length > 0) return messages;

  const prompt = typeof b.prompt === 'string' && b.prompt.trim() ? b.prompt : 'Hello';
  return [{ role: 'user', content: prompt.slice(0, MAX_CHAT_CHARS) }];
}
