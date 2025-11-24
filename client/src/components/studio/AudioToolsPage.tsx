import { useState, useContext, useEffect } from 'react';
import { AudioToolRouter } from './effects/AudioToolRouter';
import { StudioAudioContext } from '@/pages/studio';
import { Music, Wrench } from 'lucide-react';

export default function AudioToolsPage() {
  const studioContext = useContext(StudioAudioContext);
  const [localUrl, setLocalUrl] = useState('');
  const [localName, setLocalName] = useState('');

  // Prioritize context song, fallback to local upload
  const activeUrl = studioContext.currentUploadedSong?.accessibleUrl || localUrl;
  const activeName = studioContext.currentUploadedSong?.name || localName;

  const handleLocalAudioLoad = (url: string, name: string) => {
    setLocalUrl(url);
    setLocalName(name);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Audio Tools</h2>
            <p className="text-sm text-muted-foreground">Professional audio processing suite</p>
          </div>
        </div>
        
        {activeName && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-900/20 border border-blue-500/30 rounded-full">
            <Music className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-100">
              Processing: <span className="text-white font-bold">{activeName}</span>
            </span>
          </div>
        )}
      </div>

      {/* Main Router Content */}
      <div className="flex-1 overflow-y-auto">
        <AudioToolRouter
          songUrl={activeUrl}
          songName={activeName}
          recommendations={[]}
          onAudioLoad={handleLocalAudioLoad}
        />
      </div>
    </div>
  );
}
