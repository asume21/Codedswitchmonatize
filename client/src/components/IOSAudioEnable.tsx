import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Volume2, 
  VolumeX,
  Smartphone
} from "lucide-react";

export function IOSAudioEnable() {
  const [isMobile, setIsMobile] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Detect ALL mobile devices (iOS + Android)
    const mobile = /iPad|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
    
    if (mobile) {
      // Check if audio context is already enabled
      const checkAudioContext = () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            setShowPrompt(true);
          } else {
            setAudioEnabled(true);
          }
        } catch (error) {
          console.warn('AudioContext not supported');
        }
      };
      
      checkAudioContext();
    }
  }, []);

  const enableAudio = async () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Create a brief silent audio to unlock iOS audio
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      
      setAudioEnabled(true);
      setShowPrompt(false);
    } catch (error) {
      console.error('Failed to enable audio:', error);
    }
  };

  if (!isMobile || audioEnabled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <Smartphone className="h-12 w-12 mx-auto mb-2 text-blue-500" />
            <h2 className="text-lg font-semibold mb-2">Enable Audio</h2>
            <p className="text-sm text-gray-600">
              Mobile browsers require user interaction to enable audio. 
              Tap the button below to activate audio for the music studio.
            </p>
          </div>
          
          <Button onClick={enableAudio} className="w-full">
            <Volume2 className="h-4 w-4 mr-2" />
            Enable Audio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
