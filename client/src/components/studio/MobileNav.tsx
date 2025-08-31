interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const tabs = [
    { id: "beatmaker", icon: "fas fa-drum", label: "Beats" },
    { id: "melody", icon: "fas fa-music", label: "Melody" },
    { id: "codebeat", icon: "fas fa-exchange-alt", label: "Code→Music" },
    { id: "musiccode", icon: "fas fa-code-branch", label: "Music→Code" },
    { id: "assistant", icon: "fas fa-robot", label: "AI" },
    { id: "security", icon: "fas fa-shield-alt", label: "Security" },
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