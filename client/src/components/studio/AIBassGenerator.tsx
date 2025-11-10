import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Loader2, Music2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BassGeneratorProps {
  chordProgression?: Array<{ chord: string; duration: number }>;
  onBassGenerated?: (bassNotes: any[]) => void;
}

export default function AIBassGenerator({ chordProgression, onBassGenerated }: BassGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [bassStyle, setBassStyle] = useState('808');
  const [patternType, setPatternType] = useState('root-fifth');
  const [octave, setOctave] = useState([2]); // Default octave 2 (bass range)
  const [groove, setGroove] = useState([50]); // Swing/groove amount
  const [noteLength, setNoteLength] = useState([75]); // Staccato to legato
  const [velocity, setVelocity] = useState([70]); // Note velocity
  const [glide, setGlide] = useState([0]); // Glide/portamento
  const { toast } = useToast();

  const bassStyles = [
    { value: '808', label: '🔊 808 Bass', description: 'Deep trap/hip-hop bass' },
    { value: 'sub', label: '🌊 Sub Bass', description: 'Pure sine wave sub' },
    { value: 'synth', label: '⚡ Synth Bass', description: 'Funky plucky bass' },
    { value: 'electric', label: '🎸 Electric Bass', description: 'Slap/fingerstyle' },
    { value: 'upright', label: '🎻 Upright Bass', description: 'Jazz acoustic bass' },
  ];

  const patternTypes = [
    { value: 'root', label: 'Root Notes', description: 'Simple root following' },
    { value: 'root-fifth', label: 'Root + 5th', description: 'Root and fifth alternating' },
    { value: 'walking', label: 'Walking Bass', description: 'Chromatic movement' },
    { value: 'arpeggio', label: 'Arpeggiated', description: 'Chord tone arpeggios' },
    { value: 'rhythmic', label: 'Rhythmic', description: 'Syncopated patterns' },
  ];

  const generateBassLine = async () => {
    if (!chordProgression || chordProgression.length === 0) {
      toast({
        title: "No Chords Found",
        description: "Generate a chord progression first!",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Call AI to generate bass line
      const response = await fetch('/api/music/generate-bass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chordProgression,
          style: bassStyle,
          pattern: patternType,
          octave: octave[0],
          groove: groove[0] / 100,
          noteLength: noteLength[0] / 100,
          velocity: velocity[0] / 127,
          glide: glide[0] / 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate bass line');
      }

      const data = await response.json();
      
      toast({
        title: "🎸 Bass Generated!",
        description: `Created ${data.bassNotes.length} bass notes using ${bassStyles.find(s => s.value === bassStyle)?.label}`,
      });

      // Pass bass notes to parent
      if (onBassGenerated) {
        onBassGenerated(data.bassNotes);
      }

    } catch (error) {
      console.error('Bass generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Could not generate bass line. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-400">
          <Music2 className="w-5 h-5" />
          AI Bass Generator
          <span className="text-xs text-gray-500 font-normal ml-auto">Bass Dragon Style</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bass Style Selector */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-300">Bass Style</Label>
          <Select value={bassStyle} onValueChange={setBassStyle}>
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {bassStyles.map(style => (
                <SelectItem key={style.value} value={style.value}>
                  <div className="flex flex-col">
                    <span>{style.label}</span>
                    <span className="text-xs text-gray-400">{style.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pattern Type */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-300">Pattern Type</Label>
          <Select value={patternType} onValueChange={setPatternType}>
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {patternTypes.map(pattern => (
                <SelectItem key={pattern.value} value={pattern.value}>
                  <div className="flex flex-col">
                    <span>{pattern.label}</span>
                    <span className="text-xs text-gray-400">{pattern.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Octave Selector */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Octave</Label>
            <span className="text-xs text-purple-400 font-bold">{octave[0]}</span>
          </div>
          <Slider
            value={octave}
            onValueChange={setOctave}
            min={0}
            max={4}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Sub Bass</span>
            <span>Mid Bass</span>
          </div>
        </div>

        {/* Groove Amount */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Groove / Swing</Label>
            <span className="text-xs text-purple-400 font-bold">{groove[0]}%</span>
          </div>
          <Slider
            value={groove}
            onValueChange={setGroove}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Note Length */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Note Length</Label>
            <span className="text-xs text-purple-400 font-bold">{noteLength[0]}%</span>
          </div>
          <Slider
            value={noteLength}
            onValueChange={setNoteLength}
            min={10}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Staccato</span>
            <span>Legato</span>
          </div>
        </div>

        {/* Velocity */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Velocity</Label>
            <span className="text-xs text-purple-400 font-bold">{velocity[0]}</span>
          </div>
          <Slider
            value={velocity}
            onValueChange={setVelocity}
            min={20}
            max={127}
            step={1}
            className="w-full"
          />
        </div>

        {/* Glide Amount */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm text-gray-300">Glide / Portamento</Label>
            <span className="text-xs text-purple-400 font-bold">{glide[0]}%</span>
          </div>
          <Slider
            value={glide}
            onValueChange={setGlide}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateBassLine}
          disabled={isGenerating || !chordProgression || chordProgression.length === 0}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Bass...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate Bass Line
            </>
          )}
        </Button>

        {/* Info */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
          AI analyzes your chord progression to create perfect bass lines
        </div>
      </CardContent>
    </Card>
  );
}
