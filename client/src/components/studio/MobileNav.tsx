interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const tabs = [
    { id: "beatmaker", icon: "fas fa-drum", label: "Beats" },
    { id: "musicmixer", icon: "fas fa-sliders-h", label: "Studio" },
    { id: "melody", icon: "fas fa-music", label: "Melody" },
    { id: "professionalmixer", icon: "fas fa-mixing-board", label: "Pro" },
    { id: "assistant", icon: "fas fa-robot", label: "AI" },
    { id: "midi", icon: "fas fa-piano", label: "MIDI" },
  ];

  return (
    <div className="mobile-nav md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`mobile-nav-item ${
            activeTab === tab.id ? "active" : ""
          }`}
          title={tab.label}
        >
          <i className={`${tab.icon} text-sm mb-1`}></i>
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}