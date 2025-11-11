import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutManager, defaultLayouts } from '@/components/playground/LayoutManager';
import { PanelNode } from '@/components/playground/PanelContainer';
import WorkflowSelector from '@/components/studio/WorkflowSelector';
import type { WorkflowPreset } from '@/components/studio/WorkflowSelector';
import { Settings, Workflow } from 'lucide-react';

export default function LayoutStudio() {
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(true);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowPreset['id'] | null>(null);
  const [currentLayout, setCurrentLayout] = useState<PanelNode>(defaultLayouts.classic);
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'dense'>('comfortable');

  const handleSelectWorkflow = (workflowId: WorkflowPreset['id']) => {
    // Map workflow IDs to layout templates
    const layoutMap: Record<WorkflowPreset['id'], PanelNode> = {
      mixing: defaultLayouts.mixing,
      ai: defaultLayouts.ai,
      composition: defaultLayouts.composition,
      immersive: defaultLayouts.immersive,
      beginner: defaultLayouts.beginner
    };

    setCurrentLayout(layoutMap[workflowId]);
    setCurrentWorkflow(workflowId);
    setShowWorkflowSelector(false);
  };

  const handleSkipWorkflow = () => {
    setCurrentWorkflow(null);
    setCurrentLayout(defaultLayouts.classic);
    setShowWorkflowSelector(false);
  };

  const handleChangeWorkflow = () => {
    setShowWorkflowSelector(true);
  };

  return (
    <div className="h-screen flex flex-col">
      {showWorkflowSelector ? (
        <WorkflowSelector
          onSelectWorkflow={handleSelectWorkflow}
          onSkip={handleSkipWorkflow}
        />
      ) : (
        <>
          {/* Studio Header */}
          <div className="border-b p-3 flex items-center justify-between bg-background">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold" data-testid="text-studio-title">
                CodedSwitch Studio
              </h1>
              {currentWorkflow && (
                <div className="text-sm text-muted-foreground">
                  Current workflow: <span className="font-medium capitalize">{currentWorkflow}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Density Controls */}
              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  size="sm"
                  variant={density === 'comfortable' ? 'default' : 'ghost'}
                  onClick={() => setDensity('comfortable')}
                  data-testid="button-density-comfortable"
                >
                  Comfortable
                </Button>
                <Button
                  size="sm"
                  variant={density === 'compact' ? 'default' : 'ghost'}
                  onClick={() => setDensity('compact')}
                  data-testid="button-density-compact"
                >
                  Compact
                </Button>
                <Button
                  size="sm"
                  variant={density === 'dense' ? 'default' : 'ghost'}
                  onClick={() => setDensity('dense')}
                  data-testid="button-density-dense"
                >
                  Dense
                </Button>
              </div>

              {/* Change Workflow Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeWorkflow}
                data-testid="button-change-workflow"
              >
                <Workflow className="w-4 h-4 mr-2" />
                Change Workflow
              </Button>
            </div>
          </div>

          {/* Layout Manager */}
          <div className="flex-1 overflow-hidden">
            <LayoutManager
              initialLayout={currentLayout}
              density={density}
            />
          </div>
        </>
      )}
    </div>
  );
}
