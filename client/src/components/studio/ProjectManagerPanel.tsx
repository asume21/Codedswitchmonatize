import { useState, useEffect, useCallback } from 'react';
import { Save, FilePlus, Clock, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useStudioStore } from '@/stores/useStudioStore';
import {
  listProjects,
  loadProject,
  saveProjectToCloud,
  deleteProject,
  type CloudProjectSummary,
} from '@/lib/projectManager';

/**
 * Your account's projects. Saves and opens the studio's REAL state:
 * `getProjectData` returns the workspace snapshot, `onProjectLoaded` applies one.
 * (Before 2026-10-07 this panel saved an empty ProjectState the studio never
 * read, against an API that didn't exist — product review M2/M5.)
 */
interface ProjectManagerPanelProps {
  getProjectData?: () => unknown;
  onProjectLoaded?: (data: unknown) => void;
  onClose?: () => void;
}

export default function ProjectManagerPanel({ getProjectData, onProjectLoaded, onClose }: ProjectManagerPanelProps) {
  const { toast } = useToast();
  const cloudProject = useStudioStore((s) => s.cloudProject);
  const setCloudProject = useStudioStore((s) => s.setCloudProject);
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [showSaveAs, setShowSaveAs] = useState(false);
  const canSave = Boolean(getProjectData);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (err) {
      toast({ title: 'Could not load your projects', description: String((err as Error)?.message ?? err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const save = useCallback(async (asNew: boolean) => {
    if (!getProjectData) return;
    const name = (asNew ? saveAsName : cloudProject?.name)?.trim() || `Untitled ${new Date().toLocaleDateString()}`;
    setSaving(true);
    try {
      const saved = await saveProjectToCloud({
        id: asNew ? null : cloudProject?.id,
        name,
        data: getProjectData(),
      });
      setCloudProject({ id: saved.id, name: saved.name });
      setShowSaveAs(false);
      setSaveAsName('');
      toast({ title: 'Saved to your account', description: saved.name });
      fetchProjects();
    } catch (err) {
      toast({ title: 'Save failed', description: String((err as Error)?.message ?? err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [getProjectData, saveAsName, cloudProject, setCloudProject, toast, fetchProjects]);

  const handleOpen = useCallback(async (projectId: string) => {
    if (!onProjectLoaded) return;
    setLoading(true);
    try {
      const project = await loadProject(projectId);
      onProjectLoaded(project.data);
      setCloudProject({ id: project.id, name: project.name });
      toast({ title: 'Project opened', description: project.name });
      onClose?.();
    } catch (err) {
      toast({ title: 'Open failed', description: String((err as Error)?.message ?? err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [onProjectLoaded, setCloudProject, toast, onClose]);

  const handleDelete = useCallback(async (project: CloudProjectSummary) => {
    if (!window.confirm(`Delete "${project.name}" from your account? This can't be undone.`)) return;
    try {
      await deleteProject(project.id);
      if (cloudProject?.id === project.id) setCloudProject(null);
      toast({ title: 'Project deleted', description: project.name });
      fetchProjects();
    } catch (err) {
      toast({ title: 'Delete failed', description: String((err as Error)?.message ?? err), variant: 'destructive' });
    }
  }, [cloudProject, setCloudProject, toast, fetchProjects]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-700 max-w-lg w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Your Projects</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white">
            Close
          </Button>
        )}
      </div>

      {canSave && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save(false)} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {cloudProject ? `Save "${cloudProject.name}"` : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowSaveAs((v) => !v)} className="gap-1">
            <FilePlus className="w-4 h-4" /> Save as new
          </Button>
        </div>
      )}

      {showSaveAs && (
        <div className="flex gap-2">
          <Input
            placeholder="Project name..."
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save(true)}
            className="bg-zinc-800 border-zinc-600 text-white"
            autoFocus
          />
          <Button size="sm" onClick={() => save(true)} disabled={saving}>Save</Button>
        </div>
      )}

      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
        {loading && <span className="text-sm text-zinc-400">Loading...</span>}
        {!loading && projects.length === 0 && (
          <span className="text-sm text-zinc-500">No saved projects yet.</span>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
              p.id === cloudProject?.id ? 'bg-purple-500/20 border border-purple-500/40' : 'hover:bg-zinc-800'
            }`}
          >
            <button
              onClick={() => handleOpen(p.id)}
              disabled={!onProjectLoaded}
              className="flex-1 text-left disabled:cursor-default"
            >
              <div className="text-sm text-white font-medium">{p.name}</div>
              <div className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'Unknown'}
              </div>
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(p)}
              className="text-zinc-500 hover:text-red-400 p-1 h-auto"
              aria-label={`Delete ${p.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
