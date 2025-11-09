import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AudioToolRouter } from './effects/AudioToolRouter';

export default function AudioToolsPage() {
  const [audioUrl, setAudioUrl] = useState('');
  const [songName, setSongName] = useState('');
  const [showTools, setShowTools] = useState(false);

  const handleLoadAudio = () => {
    if (!audioUrl.trim()) {
      alert('Please enter an audio URL');
      return;
    }
    setShowTools(true);
  };

  if (showTools && audioUrl) {
    return (
      <div className="h-full flex flex-col overflow-hidden p-6">
        <Button 
          variant="outline" 
          onClick={() => setShowTools(false)}
          className="mb-4 w-fit"
        >
          ← Back to Audio Tools
        </Button>
        <AudioToolRouter
          songUrl={audioUrl}
          songName={songName || 'Audio File'}
          recommendations={[]}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <i className="fas fa-sliders-h text-blue-500"></i>
            Audio Processing Tools
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Professional audio effects suite for EQ, compression, reverb, and more
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quick Access */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Load Audio File</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Audio URL or File Path
                </label>
                <Input
                  type="text"
                  placeholder="Enter audio URL (http://... or /api/...)"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Song Name (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="My Track"
                  value={songName}
                  onChange={(e) => setSongName(e.target.value)}
                  className="w-full"
                />
              </div>

              <Button 
                onClick={handleLoadAudio}
                className="w-full"
                size="lg"
              >
                <i className="fas fa-play mr-2"></i>
                Open in Audio Tools
              </Button>
            </div>
          </div>

          {/* Available Tools */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Available Tools</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                <i className="fas fa-sliders-h text-blue-400"></i>
                <div>
                  <div className="text-sm font-medium">Equalizer</div>
                  <div className="text-xs text-muted-foreground">5-band parametric EQ</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                <i className="fas fa-compress text-purple-400"></i>
                <div>
                  <div className="text-sm font-medium">Compressor</div>
                  <div className="text-xs text-muted-foreground">Dynamic range control</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded">
                <i className="fas fa-microphone text-green-400"></i>
                <div>
                  <div className="text-sm font-medium">De-esser</div>
                  <div className="text-xs text-muted-foreground">Sibilance reduction</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded">
                <i className="fas fa-broadcast-tower text-indigo-400"></i>
                <div>
                  <div className="text-sm font-medium">Reverb</div>
                  <div className="text-xs text-muted-foreground">Space simulation</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded">
                <i className="fas fa-chart-line text-red-400"></i>
                <div>
                  <div className="text-sm font-medium">Limiter</div>
                  <div className="text-xs text-muted-foreground">Peak control</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                <i className="fas fa-shield-alt text-orange-400"></i>
                <div>
                  <div className="text-sm font-medium">Noise Gate</div>
                  <div className="text-xs text-muted-foreground">Background removal</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access Tip */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded">
            <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Quick Access</h4>
            <p className="text-xs text-muted-foreground">
              You can also access these tools from:
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>• <strong>Song Uploader</strong> → Analyze → Open Tools</li>
              <li>• <strong>Beat Maker</strong> → Process Beat button (coming soon)</li>
              <li>• <strong>Melody Composer</strong> → Process Melody button (coming soon)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
