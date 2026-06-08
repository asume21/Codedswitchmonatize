import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

/** Fire `window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))` to open
 *  the palette from anywhere (matches what Cmd/Ctrl+K does). */
export const OPEN_COMMAND_PALETTE_EVENT = "codedswitch:open-command-palette";

interface PaletteEntry {
  label: string;
  path: string;
  keywords?: string;
}

const SURFACES: PaletteEntry[] = [
  {
    label: "MAKE",
    path: "/studio/make",
    keywords: "studio live performance voice organism freestyle lyrics rap",
  },
  {
    label: "MIX",
    path: "/studio/mix",
    keywords: "studio beat maker piano roll mixer daw arrangement audio tools",
  },
  {
    label: "SHARE",
    path: "/studio/share",
    keywords: "studio social hub feed community profiles",
  },
  {
    label: "LIBRARY",
    path: "/studio/library",
    keywords: "studio samples saved beats projects upload",
  },
];

const OVERLAYS: PaletteEntry[] = [
  {
    label: "Code Translator",
    path: "/studio/mix?modal=translator",
    keywords: "code music translate codebeat harmony",
  },
  {
    label: "AI Assistant",
    path: "/studio/mix?modal=assistant",
    keywords: "chat help ai astutely",
  },
];

const PAGES: PaletteEntry[] = [
  { label: "Dashboard", path: "/dashboard", keywords: "home overview" },
  { label: "Social Hub", path: "/social-hub", keywords: "feed community songs share" },
  { label: "Voice Convert", path: "/voice-convert", keywords: "voice clone convert" },
  { label: "Vulnerability Scanner", path: "/vulnerability-scanner", keywords: "security code scan cve" },
  { label: "Sample Library", path: "/sample-library", keywords: "samples sounds" },
  { label: "Profile", path: "/profile", keywords: "account me" },
  { label: "Settings", path: "/settings", keywords: "preferences config" },
  { label: "Pricing", path: "/pricing", keywords: "billing plan subscription credits" },
  { label: "Blog", path: "/blog", keywords: "articles posts" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    // Allow UI affordances (e.g. the studio rail's ⌘K button) to open the
    // same palette programmatically, so the keyboard shortcut and the button
    // stay in sync instead of pointing at different things.
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openHandler);
    };
  }, []);

  const run = useCallback(
    (path: string) => {
      setOpen(false);
      setLocation(path);
    },
    [setLocation],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a surface, overlay, or page…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Surfaces">
          {SURFACES.map((entry) => (
            <CommandItem
              key={`surface:${entry.path}`}
              value={`${entry.label} ${entry.keywords ?? ""}`}
              onSelect={() => run(entry.path)}
            >
              {entry.label}
              <CommandShortcut>{entry.path}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Overlays">
          {OVERLAYS.map((entry) => (
            <CommandItem
              key={`overlay:${entry.path}`}
              value={`${entry.label} ${entry.keywords ?? ""}`}
              onSelect={() => run(entry.path)}
            >
              {entry.label}
              <CommandShortcut>{entry.path}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Pages">
          {PAGES.map((entry) => (
            <CommandItem
              key={`page:${entry.path}`}
              value={`${entry.label} ${entry.keywords ?? ""}`}
              onSelect={() => run(entry.path)}
            >
              {entry.label}
              <CommandShortcut>{entry.path}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
