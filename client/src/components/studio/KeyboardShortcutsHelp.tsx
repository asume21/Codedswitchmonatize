import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string;
  desc: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Transport",
    shortcuts: [
      { keys: "Space", desc: "Play / pause" },
      { keys: "Home", desc: "Jump to start" },
      { keys: "End", desc: "Jump to end" },
      { keys: "← / →", desc: "Seek by beat" },
      { keys: "[ / ]", desc: "Zoom out / in" },
      { keys: "= / -", desc: "Zoom in / out" },
      { keys: "L", desc: "Toggle loop" },
    ],
  },
  {
    title: "Studio Tabs",
    shortcuts: [
      { keys: "1", desc: "Beat Lab" },
      { keys: "2", desc: "Piano Roll" },
      { keys: "3", desc: "Mixer" },
      { keys: "4", desc: "Arrangement" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: "Ctrl / ⌘ + Z", desc: "Undo" },
      { keys: "Ctrl / ⌘ + Shift + Z", desc: "Redo" },
      { keys: "Ctrl / ⌘ + Y", desc: "Redo" },
      { keys: "Ctrl / ⌘ + C", desc: "Copy" },
      { keys: "Ctrl / ⌘ + X", desc: "Cut" },
      { keys: "Ctrl / ⌘ + V", desc: "Paste" },
      { keys: "Ctrl / ⌘ + D", desc: "Duplicate clip" },
      { keys: "Ctrl / ⌘ + A", desc: "Select all" },
      { keys: "Ctrl / ⌘ + S", desc: "Save project" },
      { keys: "Delete / ⌫", desc: "Delete selection" },
      { keys: "S", desc: "Split clip at playhead" },
      { keys: "G", desc: "Toggle grid" },
      { keys: "N", desc: "Toggle snap to grid" },
    ],
  },
  {
    title: "Mixer",
    shortcuts: [
      { keys: "S", desc: "Solo selected track" },
      { keys: "M", desc: "Mute selected track" },
    ],
  },
  {
    title: "Organism",
    shortcuts: [
      { keys: "O", desc: "Start / stop Organism" },
      { keys: "C", desc: "Capture session" },
      { keys: "M", desc: "Download MIDI" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { keys: "?", desc: "Show this cheatsheet" },
      { keys: "Ctrl + Shift + K", desc: "Panic: kill all audio" },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <span className="text-cyan-400">⌨</span> Keyboard Shortcuts
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-1">
            Press <Kbd>?</Kbd> any time to open this. Shortcuts are ignored while typing in inputs.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-400 mb-2">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <li
                    key={s.keys}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-gray-300">{s.desc}</span>
                    <Kbd>{s.keys}</Kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-200 text-xs font-mono whitespace-nowrap">
      {children}
    </kbd>
  );
}

export default KeyboardShortcutsHelp;
