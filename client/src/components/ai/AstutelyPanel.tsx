// client/src/components/ai/AstutelyPanel.tsx
// ASTUTELY - The AI that makes beats legendary

import { useState } from 'react';
import { Sparkles, X, Loader2, Music, Zap } from 'lucide-react';
import { astutelyGenerate, astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { useToast } from '@/hooks/use-toast';

const styles = [
  { name: "Travis Scott rage", emoji: "🔥", color: "from-red-600 to-orange-600" },
  { name: "The Weeknd dark", emoji: "🌙", color: "from-purple-900 to-pink-900" },
  { name: "Drake smooth", emoji: "🦉", color: "from-amber-600 to-yellow-600" },
  { name: "K-pop cute", emoji: "💖", color: "from-pink-500 to-rose-500" },
  { name: "Phonk drift", emoji: "🚗", color: "from-red-800 to-black" },
  { name: "Future bass", emoji: "⚡", color: "from-cyan-500 to-blue-600" },
  { name: "Lo-fi chill", emoji: "☕", color: "from-amber-800 to-orange-900" },
  { name: "Hyperpop glitch", emoji: "💊", color: "from-fuchsia-500 to-cyan-400" },
  { name: "Afrobeats bounce", emoji: "🌍", color: "from-green-600 to-yellow-500" },
  { name: "Latin trap", emoji: "🌴", color: "from-orange-500 to-red-600" },
];

interface AstutelyPanelProps {
  onClose: () => void;
  onGenerated?: (result: AstutelyResult) => void;
}

export default function AstutelyPanel({ onClose, onGenerated }: AstutelyPanelProps) {
  const [selectedStyle, setSelectedStyle] = useState(styles[0].name);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<AstutelyResult | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    toast({ title: '✨ Astutely Activated', description: `Creating ${selectedStyle} beat...` });
    
    try {
      const result = await astutelyGenerate(selectedStyle);
      setGeneratedResult(result);
      
      toast({ 
        title: '🔥 Beat Generated!', 
        description: `${result.drums.length} drums, ${result.bass.length} bass, ${result.melody.length} melody notes at ${result.bpm} BPM` 
      });
      
      if (onGenerated) {
        onGenerated(result);
      }
      
      // Auto-close after success
      setTimeout(() => onClose(), 2000);
      
    } catch (error) {
      toast({ 
        title: '❌ Generation Failed', 
        description: 'Astutely encountered an error. Try again!',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedStyleData = styles.find(s => s.name === selectedStyle) || styles[0];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-[#1a1025] to-[#0f0a1a] rounded-2xl p-8 max-w-lg w-full mx-4 border border-purple-500/30"
        style={{ boxShadow: '0 0 100px rgba(139, 92, 246, 0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
              }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Astutely
              </h2>
              <p className="text-gray-400 text-sm">AI Beat Transformer</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <p className="text-gray-300 mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Transform your loop into a full beat instantly
        </p>

        {/* Style Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8 max-h-[320px] overflow-y-auto pr-2">
          {styles.map(style => (
            <button
              key={style.name}
              onClick={() => setSelectedStyle(style.name)}
              disabled={isGenerating}
              className={`p-4 rounded-xl font-medium transition-all text-left ${
                selectedStyle === style.name
                  ? 'ring-2 ring-purple-500 scale-[1.02]'
                  : 'hover:bg-white/10'
              }`}
              style={{
                background: selectedStyle === style.name 
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))'
                  : 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-2xl mb-1 block">{style.emoji}</span>
              <span className="text-white font-semibold block">{style.name}</span>
            </button>
          ))}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-5 rounded-xl font-bold text-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          style={{
            background: isGenerating 
              ? 'rgba(139, 92, 246, 0.3)'
              : 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            boxShadow: isGenerating ? 'none' : '0 0 40px rgba(139, 92, 246, 0.4)',
            transform: isGenerating ? 'scale(1)' : 'scale(1)',
          }}
          onMouseEnter={(e) => !isGenerating && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Generating Magic...
            </>
          ) : (
            <>
              <Music className="w-6 h-6" />
              Make It Bang 🔥
            </>
          )}
        </button>

        {/* Result Preview */}
        {generatedResult && (
          <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="text-green-400 font-semibold flex items-center gap-2">
              ✅ Beat Generated Successfully!
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {generatedResult.bpm} BPM • Key of {generatedResult.key} • {generatedResult.style}
            </p>
          </div>
        )}

        {/* Keyboard hint */}
        <p className="text-center text-gray-500 text-xs mt-4">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-purple-400">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
