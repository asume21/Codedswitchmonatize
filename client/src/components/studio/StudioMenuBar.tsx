import React from 'react';
import { Button } from '@/components/ui/button';

interface StudioMenuBarProps {
  onNewProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
  onImportAudio: () => void;
  onExportAudio: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onShowPreferences: () => void;
  onShowKeyboardShortcuts: () => void;
  onResetLayout: () => void;
  toast: (options: { title: string; description?: string }) => void;
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
  onImportAudio,
  onExportAudio,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onSelectAll,
  onShowPreferences,
  onShowKeyboardShortcuts,
  onResetLayout,
  toast,
}: StudioMenuBarProps) {
  return (
    <div className="flex space-x-0.5">
      {/* File Menu */}
      <DropdownMenu label="File">
        <MenuItem label="New Project" shortcut="Ctrl+N" onClick={onNewProject} />
        <MenuItem label="Open Project..." shortcut="Ctrl+O" onClick={onLoadProject} />
        <MenuItem label="Recent Projects ▶" onClick={() => toast({ title: "Recent Projects" })} />
        <MenuDivider />
        <MenuItem label="Save Project" shortcut="Ctrl+S" onClick={onSaveProject} />
        <MenuItem label="Save As..." shortcut="Ctrl+Shift+S" onClick={() => toast({ title: "Save As..." })} />
        <MenuItem label="Save as Template..." onClick={() => toast({ title: "Save Template" })} />
        <MenuDivider />
        <MenuItem label="Import Audio..." shortcut="Ctrl+I" onClick={onImportAudio} />
        <MenuItem label="Export Audio..." shortcut="Ctrl+E" onClick={onExportAudio} />
        <MenuItem label="Export MIDI..." onClick={() => toast({ title: "Export MIDI" })} />
        <MenuDivider />
        <MenuItem label="Project Settings..." onClick={() => toast({ title: "Project Settings" })} />
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
        <MenuItem label="Deselect All" shortcut="Ctrl+D" onClick={() => toast({ title: "Deselect All" })} />
        <MenuDivider />
        <MenuItem label="Preferences..." shortcut="Ctrl+," onClick={onShowPreferences} />
      </DropdownMenu>

      {/* View Menu */}
      <DropdownMenu label="View">
        <MenuItem label="Zoom In" shortcut="Ctrl+=" onClick={() => toast({ title: "Zoom In" })} />
        <MenuItem label="Zoom Out" shortcut="Ctrl+-" onClick={() => toast({ title: "Zoom Out" })} />
        <MenuItem label="Fit to Window" shortcut="Ctrl+0" onClick={() => toast({ title: "Fit to Window" })} />
        <MenuDivider />
        <MenuItem label="Show Grid" shortcut="G" onClick={() => toast({ title: "Grid toggled" })} />
        <MenuItem label="Snap to Grid" shortcut="Ctrl+G" onClick={() => toast({ title: "Snap toggled" })} />
        <MenuDivider />
        <MenuItem label="Full Screen" shortcut="F11" onClick={() => toast({ title: "Full Screen" })} />
      </DropdownMenu>

      {/* Tools Menu */}
      <DropdownMenu label="Tools">
        <MenuItem label="Tuner" shortcut="T" onClick={() => toast({ title: "Tuner opened" })} />
        <MenuItem label="Metronome" shortcut="M" onClick={() => toast({ title: "Metronome toggled" })} />
        <MenuDivider />
        <MenuItem label="Quantize..." shortcut="Q" onClick={() => toast({ title: "Quantize" })} />
        <MenuItem label="Transpose..." onClick={() => toast({ title: "Transpose" })} />
        <MenuItem label="Time Stretch..." onClick={() => toast({ title: "Time Stretch" })} />
      </DropdownMenu>

      {/* Help Menu */}
      <DropdownMenu label="Help">
        <MenuItem label="Keyboard Shortcuts" shortcut="?" onClick={onShowKeyboardShortcuts} />
        <MenuItem label="Documentation" onClick={() => window.open('/docs', '_blank')} />
        <MenuDivider />
        <MenuItem label="Reset Layout" shortcut="Ctrl+Alt+R" onClick={onResetLayout} />
        <MenuItem label="About CodedSwitch" onClick={() => toast({ title: "CodedSwitch Studio v1.0" })} />
      </DropdownMenu>
    </div>
  );
}

export default StudioMenuBar;
