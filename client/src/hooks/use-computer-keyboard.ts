import { useState, useEffect, useCallback, useRef } from 'react';

export interface KeyboardNote {
  note: string;
  octave: number;
  key: string;
}

export interface UseComputerKeyboardOptions {
  baseOctave?: number;
  enabled?: boolean;
  onNoteOn?: (note: KeyboardNote) => void;
  onNoteOff?: (note: KeyboardNote) => void;
}

const BASE_KEY_MAP: Record<string, { note: string; octaveOffset: number }> = {
  'a': { note: 'C', octaveOffset: 0 },
  'w': { note: 'C#', octaveOffset: 0 },
  's': { note: 'D', octaveOffset: 0 },
  'e': { note: 'D#', octaveOffset: 0 },
  'd': { note: 'E', octaveOffset: 0 },
  'f': { note: 'F', octaveOffset: 0 },
  't': { note: 'F#', octaveOffset: 0 },
  'g': { note: 'G', octaveOffset: 0 },
  'y': { note: 'G#', octaveOffset: 0 },
  'h': { note: 'A', octaveOffset: 0 },
  'u': { note: 'A#', octaveOffset: 0 },
  'j': { note: 'B', octaveOffset: 0 },
  'k': { note: 'C', octaveOffset: 1 },
  'o': { note: 'C#', octaveOffset: 1 },
  'l': { note: 'D', octaveOffset: 1 },
  'p': { note: 'D#', octaveOffset: 1 },
  ';': { note: 'E', octaveOffset: 1 },
};

export function useComputerKeyboard(options: UseComputerKeyboardOptions = {}) {
  const {
    baseOctave: initialOctave = 4,
    enabled = true,
    onNoteOn,
    onNoteOff,
  } = options;

  const [octave, setOctave] = useState(initialOctave);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  const getNoteForKey = useCallback((key: string): KeyboardNote | null => {
    const mapping = BASE_KEY_MAP[key.toLowerCase()];
    if (!mapping) return null;
    
    const noteOctave = octave + mapping.octaveOffset;
    return {
      note: mapping.note,
      octave: noteOctave,
      key: `${mapping.note}${noteOctave}`,
    };
  }, [octave]);

  const octaveUp = useCallback(() => {
    setOctave(prev => Math.min(prev + 1, 7));
  }, []);

  const octaveDown = useCallback(() => {
    setOctave(prev => Math.max(prev - 1, 1));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      if (key === 'z') {
        e.preventDefault();
        octaveDown();
        return;
      }
      if (key === 'x') {
        e.preventDefault();
        octaveUp();
        return;
      }

      if (pressedKeysRef.current.has(key)) return;

      const noteInfo = getNoteForKey(key);
      if (noteInfo) {
        e.preventDefault();
        pressedKeysRef.current.add(key);
        setActiveKeys(prev => new Set(prev).add(noteInfo.key));
        onNoteOnRef.current?.(noteInfo);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (!pressedKeysRef.current.has(key)) return;
      pressedKeysRef.current.delete(key);

      const noteInfo = getNoteForKey(key);
      if (noteInfo) {
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.delete(noteInfo.key);
          return next;
        });
        onNoteOffRef.current?.(noteInfo);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, getNoteForKey, octaveUp, octaveDown]);

  return {
    octave,
    setOctave,
    octaveUp,
    octaveDown,
    activeKeys,
    getNoteForKey,
    keyMap: BASE_KEY_MAP,
  };
}
