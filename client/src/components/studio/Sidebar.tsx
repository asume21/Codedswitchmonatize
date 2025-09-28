import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: "translator", icon: "fas fa-code", label: "Code Translator" },
    { id: "beatmaker", icon: "fas fa-drum", label: "Beat Maker" },
    { id: "melody", icon: "fas fa-music", label: "Melody Composer" },
    { id: "multitrack", icon: "fas fa-layer-group", label: "Multi-Track Studio" },
    { id: "codebeat", icon: "fas fa-exchange-alt", label: "Code to Music" },
    { id: "musiccode", icon: "fas fa-code-branch", label: "Music to Code" },
    { id: "layers", icon: "fas fa-layer-group", label: "Dynamic Layering" },
    { id: "assistant", icon: "fas fa-robot", label: "AI Assistant" },
    { id: "security", icon: "fas fa-shield-alt", label: "Security Scanner" },
    { id: "lyrics", icon: "fas fa-microphone", label: "Lyric Lab" },
    { id: "musicmixer", icon: "fas fa-sliders-h", label: "Music Studio" },
    { id: "professionalmixer", icon: "fas fa-mixing-board", label: "Pro Console" },
    { id: "mixer", icon: "fas fa-sliders-v", label: "Track Mixer" },
    { id: "pack-generator", icon: "fas fa-box", label: "Pack Generator" },
    { id: "advanced-sequencer", icon: "fas fa-th-large", label: "Advanced Sequencer" },
    { id: "granular-engine", icon: "fas fa-atom", label: "Granular Engine" },
    { id: "wavetable-oscillator", icon: "fas fa-wave-square", label: "Wavetable Synth" },
    { id: "midi", icon: "fas fa-piano", label: "MIDI Controller" },
    { id: "metrics", icon: "fas fa-chart-line", label: "Performance Metrics" },
  ];

  return (
    <div className="w-48 md:w-56 lg:w-64 bg-studio-panel border-r border-gray-700 flex flex-col py-4 space-y-2 overflow-y-auto h-screen">
      <div className="px-4 mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Studio Tools</h3>
      </div>
      
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          onClick={() => { onTabChange(tab.id); }}
          className={`mx-2 h-12 rounded-lg flex items-center justify-start px-3 md:px-4 transition-colors touch-target ${
            activeTab === tab.id
              ? "bg-studio-accent hover:bg-blue-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-gray-300"
          }`}
        >
          <i className={`${tab.icon} text-lg mr-2 md:mr-3 flex-shrink-0`}></i>
          <span className="text-xs md:text-sm font-medium hidden sm:block">{tab.label}</span>
        </Button>
      ))}
      
      <div className="px-4 mt-6 pt-4 border-t border-gray-600">
        <div className="text-xs text-gray-500">
          <div className="mb-2">
            <strong className="text-gray-400">Current:</strong> {tabs.find(tab => tab.id === activeTab)?.label ?? "Unknown"}
          </div>
          <div>
            {activeTab === "beatmaker" && "Create drum patterns and beats"}
            {activeTab === "translator" && "Convert code between languages"}
            {activeTab === "melody" && "Compose musical melodies"}
            {activeTab === "codebeat" && "Turn code into music"}
            {activeTab === "musiccode" && "Convert music back to code"}
            {activeTab === "layers" && "AI-powered instrument layering"}
            {activeTab === "assistant" && "AI-powered music help & song uploads"}
            {activeTab === "security" && "Scan code for vulnerabilities"}
            {activeTab === "lyrics" && "Write and edit song lyrics"}
            {activeTab === "musicmixer" && "Unified music studio with all advanced tools"}
            {activeTab === "professionalmixer" && "World-class professional mixing console"}
            {activeTab === "mixer" && "Mix and master individual tracks"}
            {activeTab === "pack-generator" && "AI-powered sample pack creation"}
            {activeTab === "advanced-sequencer" && "Professional multi-layered sequencer"}
            {activeTab === "granular-engine" && "Advanced texture manipulation"}
            {activeTab === "wavetable-oscillator" && "Wavetable synthesis engine"}
            {activeTab === "midi" && "Connect physical MIDI controllers"}
            {activeTab === "metrics" && "AI music generation analytics"}
          </div>
        </div>
      </div>
    </div>
  );
}
