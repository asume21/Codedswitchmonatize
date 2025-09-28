import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export type DrumStep = {
  id: string;
  step: number;
  velocity: number;
  active: boolean;
};

export type DrumMachineProps = {
  pattern: DrumStep[];
  onPatternChange?: (pattern: DrumStep[]) => void;
  onAISuggest?: () => void;
};

export default function ModularDrumMachine({ pattern, onPatternChange, onAISuggest }: DrumMachineProps) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Drum Machine (AI & Manual)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-2">
          <Button size="sm" onClick={onAISuggest}>AI Suggest</Button>
          <Button size="sm" onClick={() => onPatternChange && onPatternChange([])}>Clear</Button>
        </div>
        <div className="text-gray-400 text-sm">[Drum grid and step editing coming next]</div>
      </CardContent>
    </Card>
  );
}
