export const ASTUTELY_EVENT_CHANNEL = 'astutely:event' as const;
export const ASTUTELY_COMMAND_CHANNEL = 'astutely:command' as const;

export type AstutelyCommandName =
  | 'navigate-stem-separator'
  | 'import-audio-track'
  | 'open-mixer'
  | 'focus-track'
  | 'generate'
  | 'playback'
  | 'analyze';

export interface AstutelyEventEnvelope {
  name: string;
  detail: Record<string, unknown>;
  timestamp: number;
}

export interface AstutelyCommandEnvelope {
  command: AstutelyCommandName | string;
  detail: Record<string, unknown>;
  timestamp: number;
}

export function toAstutelyLegacyChannel(eventName: string) {
  return `astutely:${eventName}`;
}
