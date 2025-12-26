import React from 'react';
import { Button } from '@/components/ui/button';

interface StudioMenuBarProps {
  onNewProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
  onSaveAs: () => void;
  onSaveTemplate: () => void;
  onRecentProjects: () => void;
  onImportAudio: () => void;
  onExportAudio: () => void;
  onExportMIDI: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onShowPreferences: () => void;
  onShowProjectSettings: () => void;
  onShowKeyboardShortcuts: () => void;
  onResetLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleFullScreen: () => void;
  onToggleMetronome: () => void;
  onShowTuner: () => void;
  onQuantize: () => void;
  onTranspose: () => void;
  onTimeStretch: () => void;
  onAbout: () => void;
}

interface MenuItemProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
}

function MenuItem({ label, shortcut, onClick }: MenuItemProps) {
  return (
    <div 
      onClick={onClick} 
      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between"
    >
      <span>{label}</span>
      {shortcut && <span className="text-xs text-gray-500">{shortcut}</span>}
    </div>
  );
}

function MenuDivider() {
  return <div className="border-t border-gray-700 my-1" />;
}

interface DropdownMenuProps {
  label: string;
  children: React.ReactNode;
}

function DropdownMenu({ label, children }: DropdownMenuProps) {
  return (
    <div className="relative group">
      <Button variant="ghost" size="sm">{label} ▼</Button>
      <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-56 z-[100]">
        {children}
      </div>
    </div>
  );
}

export function StudioMenuBar({
  onNewProject,
  onLoadProject,
  onSaveProject,
  onSaveAs,
  onSaveTemplate,
  onRecentProjects,
  onImportAudio,
  onExportAudio,
  onExportMIDI,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onSelectAll,
  onDeselectAll,
  onShowPreferences,
  onShowProjectSettings,
  onShowKeyboardShortcuts,
  onResetLayout,
  onZoomIn,
  onZoomOut,
  onFitToWindow,
  onToggleGrid,
  onToggleSnap,
  onToggleFullScreen,
  onToggleMetronome,
  onShowTuner,
  onQuantize,
  onTranspose,
  onTimeStretch,
  onAbout,
}: StudioMenuBarProps) {
  return (
    <div className="flex space-x-0.5">
      {/* File Menu */}
      <DropdownMenu label="File">
        <MenuItem label="New Project" shortcut="Ctrl+N" onClick={onNewProject} />
        <MenuItem label="Open Project..." shortcut="Ctrl+O" onClick={onLoadProject} />
        <MenuItem label="Recent Projects ▶" onClick={onRecentProjects} />
        <MenuDivider />
        <MenuItem label="Save Project" shortcut="Ctrl+S" onClick={onSaveProject} />
        <MenuItem label="Save As..." shortcut="Ctrl+Shift+S" onClick={onSaveAs} />
        <MenuItem label="Save as Template..." onClick={onSaveTemplate} />
        <MenuDivider />
        <MenuItem label="Import Audio..." shortcut="Ctrl+I" onClick={onImportAudio} />
        <MenuItem label="Export Audio..." shortcut="Ctrl+E" onClick={onExportAudio} />
        <MenuItem label="Export MIDI..." onClick={onExportMIDI} />
        <MenuDivider />
        <MenuItem label="Project Settings..." onClick={onShowProjectSettings} />
      </DropdownMenu>

      {/* Edit Menu */}
      <DropdownMenu label="Edit">
        <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={onUndo} />
        <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={onRedo} />
        <MenuDivider />
        <MenuItem label="Cut" shortcut="Ctrl+X" onClick={onCut} />
        <MenuItem label="Copy" shortcut="Ctrl+C" onClick={onCopy} />
        <MenuItem label="Paste" shortcut="Ctrl+V" onClick={onPaste} />
        <MenuItem label="Delete" shortcut="Del" onClick={onDelete} />
        <MenuDivider />
        <MenuItem label="Select All" shortcut="Ctrl+A" onClick={onSelectAll} />
        <MenuItem label="Deselect All" shortcut="Ctrl+D" onClick={onDeselectAll} />
        <MenuDivider />
        <MenuItem label="Preferences..." shortcut="Ctrl+," onClick={onShowPreferences} />
      </DropdownMenu>

      {/* View Menu */}
      <DropdownMenu label="View">
        <MenuItem label="Zoom In" shortcut="Ctrl+=" onClick={onZoomIn} />
        <MenuItem label="Zoom Out" shortcut="Ctrl+-" onClick={onZoomOut} />
        <MenuItem label="Fit to Window" shortcut="Ctrl+0" onClick={onFitToWindow} />
        <MenuDivider />
        <MenuItem label="Show Grid" shortcut="G" onClick={onToggleGrid} />
        <MenuItem label="Snap to Grid" shortcut="Ctrl+G" onClick={onToggleSnap} />
        <MenuDivider />
        <MenuItem label="Full Screen" shortcut="F11" onClick={onToggleFullScreen} />
      </DropdownMenu>

      {/* Tools Menu */}
      <DropdownMenu label="Tools">
        <MenuItem label="Tuner" shortcut="T" onClick={onShowTuner} />
        <MenuItem label="Metronome" shortcut="M" onClick={onToggleMetronome} />
        <MenuDivider />
        <MenuItem label="Quantize..." shortcut="Q" onClick={onQuantize} />
        <MenuItem label="Transpose..." onClick={onTranspose} />
        <MenuItem label="Time Stretch..." onClick={onTimeStretch} />
      </DropdownMenu>

      {/* Help Menu */}
      <DropdownMenu label="Help">
        <MenuItem label="Keyboard Shortcuts" shortcut="?" onClick={onShowKeyboardShortcuts} />
        <MenuItem label="Documentation" onClick={() => window.open('/docs', '_blank')} />
        <MenuDivider />
        <MenuItem label="Reset Layout" shortcut="Ctrl+Alt+R" onClick={onResetLayout} />
        <MenuItem label="About CodedSwitch" onClick={onAbout} />
      </DropdownMenu>
    </div>
  );
}

export default StudioMenuBar;
