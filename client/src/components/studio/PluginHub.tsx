import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings } from "lucide-react";
import CodeToMusicComp from "@/components/studio/CodeToMusic";

// Simple registry using the same ids and labels as Sidebar to ensure navigation works
const ALL_PLUGINS: Array<{
  id: string;
  label: string;
  icon: string; // font-awesome class
  category: "Studio" | "Production" | "Analysis" | "Utility";
}> = [
  { id: "translator", icon: "fas fa-code", label: "Code Translator", category: "Utility" },
  { id: "beatmaker", icon: "fas fa-drum", label: "Beat Maker", category: "Studio" },
  { id: "melody", icon: "fas fa-music", label: "Melody Composer", category: "Studio" },
  { id: "musiccode", icon: "fas fa-code-branch", label: "Music to Code", category: "Utility" },
  { id: "layers", icon: "fas fa-layer-group", label: "Dynamic Layering", category: "Studio" },
  { id: "assistant", icon: "fas fa-robot", label: "AI Assistant", category: "Utility" },
  { id: "security", icon: "fas fa-shield-alt", label: "Security Scanner", category: "Utility" },
  { id: "lyrics", icon: "fas fa-microphone", label: "Lyric Lab", category: "Studio" },
  { id: "musicmixer", icon: "fas fa-sliders-h", label: "Music Studio", category: "Production" },
  { id: "professionalmixer", icon: "fas fa-mixing-board", label: "Pro Console", category: "Production" },
  { id: "mixer", icon: "fas fa-sliders-v", label: "Track Mixer", category: "Production" },
  { id: "pack-generator", icon: "fas fa-box", label: "Pack Generator", category: "Production" },
  { id: "advanced-sequencer", icon: "fas fa-th-large", label: "Advanced Sequencer", category: "Production" },
  { id: "granular-engine", icon: "fas fa-atom", label: "Granular Engine", category: "Production" },
  { id: "wavetable-oscillator", icon: "fas fa-wave-square", label: "Wavetable Synth", category: "Production" },
  { id: "midi", icon: "fas fa-piano", label: "MIDI Controller", category: "Production" },
  { id: "metrics", icon: "fas fa-chart-line", label: "Performance Metrics", category: "Analysis" },
  { id: "song-structure", icon: "fas fa-diagram-project", label: "Song Structure", category: "Analysis" },
];

export default function PluginHub() {
  const [query, setQuery] = useState("");
  const [showCompiler, setShowCompiler] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ALL_PLUGINS;
    return ALL_PLUGINS.filter(p =>
      p.label.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [query]);

  const byCategory = useMemo(() => {
    const map: Record<string, typeof ALL_PLUGINS> = {} as any;
    for (const p of filtered) {
      map[p.category] = map[p.category] || [];
      map[p.category].push(p);
    }
    return map;
  }, [filtered]);

  const openPlugin = (id: string) => {
    // Navigate via Studio's global event handler
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("navigateToTab", { detail: id }));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold">Plugin Hub</h2>
            <p className="text-sm text-gray-400">All studio features as plugins. Click a tile to open the tool.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search plugins..."
                className="h-10 w-64 bg-studio-panel border border-gray-600 rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-studio-accent"
              />
              <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            </div>
            <Button
              onClick={() => setShowCompiler((s) => !s)}
              className="bg-studio-accent hover:bg-blue-500"
            >
              <i className="fas fa-exchange-alt mr-2" />
              {showCompiler ? "Hide Code→Music" : "Open Code→Music"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        {/* Plugin grid grouped by category */}
        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{category}</h3>
                <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? "plugin" : "plugins"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((p) => (
                  <div key={p.id} className="bg-studio-panel border border-gray-600 rounded-lg p-4 flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-md bg-gray-700 flex items-center justify-center">
                        <i className={`${p.icon} text-base text-white`} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.label}</div>
                        <div className="text-xs text-gray-400 truncate">/{p.id}</div>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <Button onClick={() => openPlugin(p.id)} className="bg-studio-accent hover:bg-blue-500 flex-1">
                        <i className="fas fa-arrow-right mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Inline Code→Music compiler (optional) */}
        {showCompiler && (
          <div className="mt-8 border-t border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Code → Music Compiler</h3>
              <Button onClick={() => setShowCompiler(false)} className="bg-gray-700 hover:bg-gray-600">
                <i className="fas fa-times mr-2" />
                Close
              </Button>
            </div>
            <div className="bg-gray-900/40 rounded-lg border border-gray-700">
              <CodeToMusicComp />
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
