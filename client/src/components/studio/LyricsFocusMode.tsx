import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { X, Save, Sparkles, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface LyricsSection {
  id: string;
  type: 'verse' | 'chorus' | 'bridge' | 'pre-chorus' | 'outro' | 'intro';
  content: string;
  timestamp: number;
}

interface LyricsFocusModeProps {
  onClose: () => void;
  initialLyrics?: string;
  onSave?: (lyrics: string, sections: LyricsSection[]) => void;
}

export default function LyricsFocusMode({ onClose, initialLyrics = '', onSave }: LyricsFocusModeProps) {
  const [sections, setSections] = useState<LyricsSection[]>([
    {
      id: 'section-1',
      type: 'verse',
      content: '',
      timestamp: 0,
    },
  ]);
  const [selectedSection, setSelectedSection] = useState<string>('section-1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const { toast } = useToast();

  const sectionTypes: Array<LyricsSection['type']> = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro'];

  const addSection = (type: LyricsSection['type']) => {
    const newSection: LyricsSection = {
      id: `section-${Date.now()}`,
      type,
      content: '',
      timestamp: 0,
    };
    setSections([...sections, newSection]);
    setSelectedSection(newSection.id);
  };

  const updateSection = (id: string, content: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, content } : s));
  };

  const deleteSection = (id: string) => {
    if (sections.length === 1) {
      toast({
        title: 'Cannot Delete',
        description: 'You must have at least one section.',
        variant: 'destructive',
      });
      return;
    }
    setSections(sections.filter(s => s.id !== id));
    if (selectedSection === id) {
      setSelectedSection(sections[0].id);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please describe the lyrics you want to generate.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      toast({
        title: 'Generating Lyrics',
        description: 'Grok AI is writing your lyrics...',
      });

      const response = await apiRequest('POST', '/api/lyrics/generate', {
        prompt: aiPrompt,
        style: 'professional',
        structure: sections.map(s => s.type).join(','),
      });

      const data = await response.json();

      if (data.lyrics) {
        // Parse AI generated lyrics into sections
        const lines = data.lyrics.split('\n');
        let currentSectionIndex = 0;
        const newSections: LyricsSection[] = [];

        lines.forEach((line: string) => {
          const sectionMatch = line.match(/\[(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro).*?\]/i);
          if (sectionMatch) {
            const type = sectionMatch[1].toLowerCase().replace('-', '') as LyricsSection['type'];
            newSections.push({
              id: `section-${Date.now()}-${currentSectionIndex}`,
              type,
              content: '',
              timestamp: 0,
            });
            currentSectionIndex++;
          } else if (line.trim() && newSections.length > 0) {
            newSections[newSections.length - 1].content += line + '\n';
          }
        });

        if (newSections.length > 0) {
          setSections(newSections);
          setSelectedSection(newSections[0].id);
        }

        toast({
          title: 'Lyrics Generated!',
          description: 'Your AI-generated lyrics are ready.',
        });
      }
    } catch (error) {
      console.error('Lyric generation error:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate lyrics. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const fullLyrics = sections
      .map(s => `[${s.type.charAt(0).toUpperCase() + s.type.slice(1)}]\n${s.content}`)
      .join('\n\n');

    if (onSave) {
      onSave(fullLyrics, sections);
    }

    toast({
      title: 'Lyrics Saved!',
      description: 'Your lyrics have been saved to the timeline.',
    });
  };

  const currentSection = sections.find(s => s.id === selectedSection);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col bg-gray-900 border-gray-700">
        <CardHeader className="border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-purple-400" />
              Lyrics Focus Mode
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-500"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Lyrics
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex overflow-hidden p-0">
          {/* Left: Section List */}
          <div className="w-64 border-r border-gray-700 flex flex-col bg-gray-800">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-medium mb-2">Song Structure</h3>
              <div className="grid grid-cols-2 gap-1">
                {sectionTypes.map((type) => (
                  <Button
                    key={type}
                    onClick={() => addSection(type)}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    + {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={`p-3 mb-2 rounded cursor-pointer transition ${
                    selectedSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {section.type.charAt(0).toUpperCase() + section.type.slice(1)} {idx + 1}
                    </span>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSection(section.id);
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs opacity-70 line-clamp-2">
                    {section.content || 'Empty section...'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Editor */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium">
                  {currentSection ? currentSection.type.charAt(0).toUpperCase() + currentSection.type.slice(1) : 'Select a section'}
                </h3>
                <Input
                  type="number"
                  placeholder="Timestamp (seconds)"
                  value={currentSection?.timestamp || 0}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value) || 0;
                    setSections(sections.map(s =>
                      s.id === selectedSection ? { ...s, timestamp: val } : s
                    ));
                  }}
                  className="w-32"
                />
              </div>
              <p className="text-sm text-gray-400">
                Write your lyrics here. Each line will sync with your music timeline.
              </p>
            </div>

            <div className="flex-1 p-4">
              <Textarea
                value={currentSection?.content || ''}
                onChange={(e) => updateSection(selectedSection, e.target.value)}
                placeholder={`Write your ${currentSection?.type} lyrics here...

Example:
Walking down this empty street
Feeling rhythm in my feet
...`}
                className="w-full h-full resize-none text-lg leading-relaxed font-mono"
              />
            </div>
          </div>

          {/* Right: AI Assistant */}
          <div className="w-80 border-l border-gray-700 flex flex-col bg-gray-800">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-medium flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />
                AI Lyric Assistant (Grok)
              </h3>
            </div>

            <div className="flex-1 p-4 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Describe your song
                </label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., 'A love song about missing someone, emotional and heartfelt'"
                  className="min-h-[120px] resize-none"
                  disabled={isGenerating}
                />
              </div>

              <Button
                onClick={handleAIGenerate}
                disabled={isGenerating || !aiPrompt.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              >
                {isGenerating ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Lyrics
                  </>
                )}
              </Button>

              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium mb-2">Quick Tips</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Use metaphors and imagery</li>
                  <li>• Keep consistent rhyme scheme</li>
                  <li>• Vary syllable counts</li>
                  <li>• Make chorus catchy and memorable</li>
                  <li>• Tell a story or convey emotion</li>
                </ul>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium mb-2">Rhyme Helper</h4>
                <Input
                  placeholder="Word to rhyme..."
                  className="mb-2"
                />
                <div className="text-xs text-gray-500">
                  Type a word to get rhyme suggestions
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
