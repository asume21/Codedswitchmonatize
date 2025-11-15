import { getStudioTabById, type StudioTabId, type StudioTabConfig } from "@/config/studioTabs";

interface MobileNavProps {
  activeTab: StudioTabId;
  onTabChange: (tab: StudioTabId) => void;
}

const MOBILE_TAB_IDS: StudioTabId[] = [
  "beatmaker",
  "musicmixer",
  "melody",
  "professionalmixer",
  "assistant",
  "midi",
];

const mobileTabs: StudioTabConfig[] = MOBILE_TAB_IDS.map((id) => getStudioTabById(id))
  .filter((tab): tab is StudioTabConfig => Boolean(tab));

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <div className="mobile-nav md:hidden">
      {mobileTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`mobile-nav-item ${activeTab === tab.id ? "active" : ""}`}
          title={tab.shortName}
        >
          <i className={`${tab.icon} text-sm mb-1`}></i>
          <span className="text-[10px]">{tab.shortName}</span>
        </button>
      ))}
    </div>
  );
}
