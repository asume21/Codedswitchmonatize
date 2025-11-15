import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sliders, Brain, Piano, Maximize2, GraduationCap, Upload } from 'lucide-react';

export interface WorkflowPreset {
  id: 'song-analyzer' | 'beginner' | 'mixing' | 'ai' | 'composition' | 'immersive';
  name: string;
  description: string;
  icon: typeof Sliders;
  color: string;
  preview: string;
}

const workflows: WorkflowPreset[] = [
  {
    id: 'song-analyzer',
    name: '🎵 Song Uploader & Analyzer',
    description: 'Upload existing songs for AI analysis, insights, and enhancement',
    icon: Upload,
    color: 'text-cyan-500',
    preview: 'AI analysis for musical structure and patterns'
  },
  {
    id: 'beginner',
    name: 'Beginner Guided',
    description: 'Step-by-step guidance for creating your first song',
    icon: GraduationCap,
    color: 'text-green-500',
    preview: 'Perfect for newcomers - learn as you create'
  },
  {
    id: 'mixing',
    name: 'Mixing Console',
    description: 'Focus on mixing and mastering your tracks',
    icon: Sliders,
    color: 'text-blue-500',
    preview: 'Timeline + Effects + Large Mixer'
  },
  {
    id: 'ai',
    name: 'AI-Assisted',
    description: 'Get creative help from AI throughout your workflow',
    icon: Brain,
    color: 'text-purple-500',
    preview: 'Instruments + Timeline + Large AI Panel'
  },
  {
    id: 'composition',
    name: 'Composition',
    description: 'Create melodies with piano roll and instruments',
    icon: Piano,
    color: 'text-orange-500',
    preview: 'Instruments + Samples + Large Piano Roll'
  },
  {
    id: 'immersive',
    name: 'Immersive Mode',
    description: 'Full-screen DAW experience with minimal distractions',
    icon: Maximize2,
    color: 'text-red-500',
    preview: 'Timeline + Piano Roll (fullscreen)'
  }
];

interface WorkflowSelectorProps {
  onSelectWorkflow: (workflowId: WorkflowPreset['id']) => void;
  onSkip?: () => void;
}

export default function WorkflowSelector({ onSelectWorkflow, onSkip }: WorkflowSelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-5xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold" data-testid="text-workflow-title">
            What are you working on today?
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-workflow-subtitle">
            Choose a workflow optimized for your task
          </p>
        </div>

        {/* Workflow Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card
                key={workflow.id}
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => onSelectWorkflow(workflow.id)}
                data-testid={`card-workflow-${workflow.id}`}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`${workflow.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                  </div>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{workflow.preview}</p>
                </CardContent>
              </Card>
            );
          })}

          {/* Custom Layout Option */}
          <Card
            className="hover-elevate cursor-pointer transition-all border-dashed"
            onClick={() => onSkip?.()}
            data-testid="card-workflow-custom"
          >
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">Custom Layout</CardTitle>
              <CardDescription>
                Start with the default layout and customize later
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Access Design Playground anytime
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Skip Button */}
        {onSkip && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={onSkip}
              data-testid="button-skip-workflow"
            >
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
