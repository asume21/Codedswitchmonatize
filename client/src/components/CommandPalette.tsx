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

type StudioView =
  | "arrangement"
  | "piano-roll"
  | "beat-lab"
  | "mixer"
  | "ai-studio"
  | "lyrics"
  | "song-uploader"
  | "code-to-music"
  | "audio-tools"
  | "multitrack"
  | "organism";

interface PageEntry {
  label: string;
  path: string;
  keywords?: string;
}

interface StudioEntry {
  label: string;
  view: StudioView;
  keywords?: string;
}

const PAGES: PageEntry[] = [
  { label: "Dashboard", path: "/dashboard", keywords: "home overview" },
  { label: "Studio", path: "/studio", keywords: "daw music compose" },
  { label: "Social Hub", path: "/social-hub", keywords: "feed community songs share" },
  { label: "AI Assistant", path: "/ai-assistant", keywords: "chat help ai" },
  { label: "Voice Convert", path: "/voice-convert", keywords: "voice clone convert" },
  { label: "Vulnerability Scanner", path: "/vulnerability-scanner", keywords: "security code scan cve" },
  { label: "Sample Library", path: "/sample-library", keywords: "samples sounds" },
  { label: "Profile", path: "/profile", keywords: "account me" },
  { label: "Settings", path: "/settings", keywords: "preferences config" },
  { label: "Pricing", path: "/pricing", keywords: "billing plan subscription credits" },
  { label: "Blog", path: "/blog", keywords: "articles posts" },
];

const STUDIO_VIEWS: StudioEntry[] = [
  { label: "Arrangement Timeline", view: "arrangement", keywords: "timeline tracks" },
  { label: "Piano Roll", view: "piano-roll", keywords: "melody midi notes" },
  { label: "Beat Lab", view: "beat-lab", keywords: "drums beat pattern rhythm" },
  { label: "Mixer", view: "mixer", keywords: "volume faders pan mix" },
  { label: "AI Studio", view: "ai-studio", keywords: "generate ai music astutely" },
  { label: "Lyric Lab", view: "lyrics", keywords: "lyrics writing bars" },
  { label: "Song Uploader", view: "song-uploader", keywords: "upload song import" },
  { label: "Code to Music", view: "code-to-music", keywords: "code translator codebeat harmony" },
  { label: "Audio Tools", view: "audio-tools", keywords: "eq compressor reverb fx" },
  { label: "Multi-Track", view: "multitrack", keywords: "layers waveform editing" },
  { label: "Hip-Hop Organism", view: "organism", keywords: "freestyle rap organism" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const runPage = useCallback(
    (path: string) => {
      setOpen(false);
      setLocation(path);
    },
    [setLocation],
  );

  const runStudioView = useCallback(
    (view: StudioView) => {
      setOpen(false);
      const onStudio = location === "/studio";
      if (onStudio) {
        window.dispatchEvent(new CustomEvent("navigateToTab", { detail: view }));
      } else {
        setLocation(`/studio?tab=${view}`);
      }
    },
    [location, setLocation],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or studio tool…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Studio Tools">
          {STUDIO_VIEWS.map((entry) => (
            <CommandItem
              key={`view:${entry.view}`}
              value={`${entry.label} ${entry.keywords ?? ""}`}
              onSelect={() => runStudioView(entry.view)}
            >
              {entry.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {PAGES.map((entry) => (
            <CommandItem
              key={`page:${entry.path}`}
              value={`${entry.label} ${entry.keywords ?? ""}`}
              onSelect={() => runPage(entry.path)}
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
