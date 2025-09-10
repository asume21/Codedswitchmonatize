import React, { useCallback } from 'react';
import { DEFAULT_customKeys } from './types/pianoRollTypes';
import { useToast } from "@/hooks/use-toast";

interface ChordProgressionDisplayProps {
  progression: {
    id: string;
    name: string;
    chords: string[];
    key: string;
  };
  currentKey: string;
  currentChordIndex: number;
  onChordClick: (chordSymbol: string, chordNotes: string[]) => void;
}

export const ChordProgressionDisplay: React.FC<ChordProgressionDisplayProps> = ({
  progression,
  currentKey,
  currentChordIndex,
  onChordClick
}) => {
  const { toast } = useToast();

  const handleChordClick = useCallback((chordSymbol: string) => {
    try {
      const keyData = DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys];
      if (!keyData?.chords?.[chordSymbol]) {
        console.error(`Chord ${chordSymbol} not found in key ${currentKey}`);
        toast({
          title: "Error",
          description: `Chord ${chordSymbol} not available in ${currentKey} key`,
          variant: "destructive"
        });
        return;
      }
      
      const chordNotes = keyData.chords[chordSymbol];
      onChordClick(chordSymbol, chordNotes);
    } catch (error) {
      console.error('Error playing chord:', error);
      toast({
        title: "Error",
        description: "Failed to play chord",
        variant: "destructive"
      });
    }
  }, [currentKey, onChordClick, toast]);

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-400 mb-2">
        {progression.name} in {DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys]?.name || currentKey}:
      </h3>
      <div className="flex flex-wrap gap-2">
        {progression.chords.map((chord, index) => {
          const isCurrent = currentChordIndex === index;
          const keyData = DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys];
          const chordNotes = keyData?.chords?.[chord];
          
          return (
            <button
              key={`${chord}-${index}`}
              onClick={() => handleChordClick(chord)}
              className={`px-3 py-2 rounded transition-colors flex flex-col items-center min-w-[60px] ${
                isCurrent 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              aria-label={`Play ${chord} chord`}
              aria-pressed={isCurrent}
            >
              <span className="font-medium">{chord}</span>
              {chordNotes && (
                <span className="text-xs opacity-75">
                  {chordNotes.join('-')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChordProgressionDisplay;
