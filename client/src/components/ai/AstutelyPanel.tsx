// client/src/components/ai/AstutelyPanel.tsx
// ASTUTELY - The AI that makes beats legendary

import { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, Music } from 'lucide-react';
import { astutelyGenerate, astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { useToast } from '@/hooks/use-toast';

const styles = [
  { name: "Travis Scott rage", icon: "🔥", preview: "808s + dark pads" },
  { name: "The Weeknd dark", icon: "🌙", preview: "Glassy synths + vocal chops" },
  { name: "Drake smooth", icon: "😌", preview: "Soft piano + trap hats" },
  { name: "K-pop cute", icon: "💖", preview: "Bright plucks + bubbly synth" },
  { name: "Phonk drift", icon: "🚗", preview: "Cowbell + slowed reverb" },
  { name: "Future bass", icon: "⚡", preview: "Wobble bass + supersaw chords" },
  { name: "Lo-fi chill", icon: "☕", preview: "Vinyl crackle + jazz chords" },
  { name: "Hyperpop glitch", icon: "💻", preview: "Chopped vocals + sidechain" },
  { name: "Afrobeats bounce", icon: "🕺", preview: "Log drums + highlife guitar" },
  { name: "Latin trap", icon: "🌴", preview: "Dem bow rhythm + reggaeton keys" },
];

interface AstutelyPanelProps {
  onClose: () => void;
  onGenerated?: (result: AstutelyResult) => void;
}

export default function AstutelyPanel({ onClose, onGenerated }: AstutelyPanelProps) {
  const [selectedStyle, setSelectedStyle] = useState(styles[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<AstutelyResult | null>(null);
  const { toast } = useToast();

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    toast({ title: '✨ Astutely Activated', description: `Creating ${selectedStyle.name} beat...` });
    
    // Simulate progress for UX
    const interval = setInterval(() => setProgress(p => Math.min(p + 15, 90)), 300);
    
    try {
      const result = await astutelyGenerate(selectedStyle.name);
      clearInterval(interval);
      setProgress(100);
      setGeneratedResult(result);
      
      // Convert to timeline notes
      const notes = astutelyToNotes(result);
      const drumCount = notes.filter(n => n.trackType === 'drums').length;
      const bassCount = notes.filter(n => n.trackType === 'bass').length;
      const chordCount = notes.filter(n => n.trackType === 'chords').length;
      const melodyCount = notes.filter(n => n.trackType === 'melody').length;
      
      toast({ 
        title: '🔥 Beat Generated & Added to Timeline!', 
        description: `${drumCount} drums, ${bassCount} bass, ${chordCount} chords, ${melodyCount} melody notes` 
      });
      
      if (onGenerated) {
        onGenerated(result);
      }
      
      // Auto-close after success
      setTimeout(() => onClose(), 1500);
      
    } catch (error) {
      clearInterval(interval);
      setProgress(0);
      toast({ 
        title: '❌ Generation Failed', 
        description: 'Astutely encountered an error. Try again!',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-10 h-10 text-yellow-400" />
            Astutely
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-300 mb-6">Transform your loop into a full beat instantly</p>

        {/* Style Grid with Previews */}
        <div className="grid grid-cols-2 gap-3 mb-6 max-h-[280px] overflow-y-auto pr-1">
          {styles.map(style => (
            <button
              key={style.name}
              onClick={() => setSelectedStyle(style)}
              disabled={isGenerating}
              className={`p-4 rounded-xl font-medium transition-all text-left ${
                selectedStyle.name === style.name
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-xl">{style.icon}</span>
                <span className="text-sm font-semibold">{style.name}</span>
                <span className={`text-xs ${selectedStyle.name === style.name ? 'text-gray-600' : 'text-gray-400'}`}>
                  {style.preview}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Freeform Prompt */}
        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 'Add 808 slides and dark pads'"
            className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
            disabled={isGenerating}
          />
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="mb-4">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-300 mt-2">
              {progress < 100 ? `Generating... ${progress}%` : 'Adding to timeline...'}
            </p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold text-xl hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Creating Magic...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Music className="w-6 h-6" />
              <span>Make It Bang 🔥</span>
            </div>
          )}
        </button>

        {/* Result Preview */}
        {generatedResult && (
          <div className="mt-4 p-4 rounded-xl bg-green-500/20 border border-green-500/40">
            <p className="text-green-400 font-semibold flex items-center gap-2">
              ✅ Added to Timeline!
            </p>
            <p className="text-gray-300 text-sm mt-1">
              {generatedResult.bpm} BPM • Key of {generatedResult.key} • {generatedResult.style}
            </p>
          </div>
        )}

        {/* Keyboard hint */}
        <p className="text-xs text-gray-400 mt-4 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
