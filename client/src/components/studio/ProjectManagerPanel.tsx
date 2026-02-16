import { useState, useEffect, useCallback } from 'react';
import { Save, FolderOpen, FilePlus, Download, Upload, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  createNewProjectState,
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  exportProjectFile,
  importProjectFile,
  loadLocalDraft,
  clearLocalDraft,
  startAutoSave,
  stopAutoSave,
  setCurrentProject,
  getCurrentProject,
  getIsDirty,
  type ProjectState,
} from '@/lib/projectManager';

interface ProjectManagerPanelProps {
  onProjectLoaded?: (project: ProjectState) => void;
  onClose?: () => void;
}

export default function ProjectManagerPanel({ onProjectLoaded, onClose }: ProjectManagerPanelProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch {
      console.warn('Could not fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const draft = loadLocalDraft();
    setDraftAvailable(!!draft);
    const current = getCurrentProject();
    if (current) setCurrentProjectId(current.id);
  }, [fetchProjects]);

  const handleNewProject = useCallback(() => {
    const name = newProjectName.trim() || 'Untitled Project';
    const project = createNewProjectState(name);
    setCurrentProject(project);
    setCurrentProjectId(project.id);
    startAutoSave();
    setShowNewProject(false);
    setNewProjectName('');
    toast({ title: 'New Project Created', description: name });
    onProjectLoaded?.(project);
  }, [newProjectName, toast, onProjectLoaded]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveProject();
      toast({ title: 'Project Saved' });
      fetchProjects();
    } catch (err) {
      toast({ title: 'Save Failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [toast, fetchProjects]);

  const handleLoad = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const project = await loadProject(projectId);
      setCurrentProjectId(project.id);
      startAutoSave();
      toast({ title: 'Project Loaded', description: project.name });
      onProjectLoaded?.(project);
    } catch (err) {
      toast({ title: 'Load Failed', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, onProjectLoaded]);

  const handleDelete = useCallback(async (projectId: string) => {
    try {
      await deleteProject(projectId);
      toast({ title: 'Project Deleted' });
      fetchProjects();
      if (currentProjectId === projectId) setCurrentProjectId(null);
    } catch (err) {
      toast({ title: 'Delete Failed', description: String(err), variant: 'destructive' });
    }
  }, [toast, fetchProjects, currentProjectId]);

  const handleExport = useCallback(() => {
    exportProjectFile();
    toast({ title: 'Project Exported', description: 'Downloaded .cswproj file' });
  }, [toast]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.cswproj,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const project = await importProjectFile(file);
        setCurrentProjectId(project.id);
        startAutoSave();
        toast({ title: 'Project Imported', description: project.name });
        onProjectLoaded?.(project);
        fetchProjects();
      } catch (err) {
        toast({ title: 'Import Failed', description: String(err), variant: 'destructive' });
      }
    };
    input.click();
  }, [toast, onProjectLoaded, fetchProjects]);

  const handleRecoverDraft = useCallback(() => {
    const draft = loadLocalDraft();
    if (!draft) return;
    setCurrentProject(draft);
    setCurrentProjectId(draft.id);
    startAutoSave();
    clearLocalDraft();
    setDraftAvailable(false);
    toast({ title: 'Draft Recovered', description: draft.name });
    onProjectLoaded?.(draft);
  }, [toast, onProjectLoaded]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-700 max-w-lg w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Project Manager</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white">
            Close
          </Button>
        )}
      </div>

      {draftAvailable && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-sm text-yellow-300">Unsaved draft found</span>
          <Button size="sm" variant="outline" onClick={handleRecoverDraft} className="ml-auto text-xs">
            Recover
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { clearLocalDraft(); setDraftAvailable(false); }} className="text-xs text-zinc-400">
            Discard
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowNewProject(true)} className="gap-1">
          <FilePlus className="w-4 h-4" /> New
        </Button>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={!currentProjectId || saving} className="gap-1">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!currentProjectId} className="gap-1">
          <Download className="w-4 h-4" /> Export
        </Button>
        <Button size="sm" variant="outline" onClick={handleImport} className="gap-1">
          <Upload className="w-4 h-4" /> Import
        </Button>
      </div>

      {showNewProject && (
        <div className="flex gap-2">
          <Input
            placeholder="Project name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
            className="bg-zinc-800 border-zinc-600 text-white"
            autoFocus
          />
          <Button size="sm" onClick={handleNewProject}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNewProject(false)}>Cancel</Button>
        </div>
      )}

      {currentProjectId && (
        <div className="text-xs text-zinc-400 flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${getIsDirty() ? 'bg-yellow-400' : 'bg-green-400'}`} />
          {getIsDirty() ? 'Unsaved changes' : 'All changes saved'}
        </div>
      )}

      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Your Projects</span>
        {loading && <span className="text-sm text-zinc-400">Loading...</span>}
        {!loading && projects.length === 0 && (
          <span className="text-sm text-zinc-500">No projects yet. Create one above.</span>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
              p.id === currentProjectId ? 'bg-purple-500/20 border border-purple-500/40' : 'hover:bg-zinc-800'
            }`}
          >
            <button onClick={() => handleLoad(p.id)} className="flex-1 text-left">
              <div className="text-sm text-white font-medium">{p.name}</div>
              <div className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Unknown'}
              </div>
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
              className="text-zinc-500 hover:text-red-400 p-1 h-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
