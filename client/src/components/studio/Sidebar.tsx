import { Button } from "@/components/ui/button";
import { STUDIO_TABS, type StudioTabId } from "@/config/studioTabs";

interface SidebarProps {
  activeTab: StudioTabId;
  onTabChange: (tab: StudioTabId) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = STUDIO_TABS;
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab);

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
            <strong className="text-gray-400">Current:</strong> {activeTabMeta?.label ?? "Unknown"}
          </div>
          <div>
            {activeTabMeta?.description ?? "Select a tool to view details."}
          </div>
        </div>
      </div>
    </div>
  );
}
