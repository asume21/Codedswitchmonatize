import React from 'react'
import { useAudioAnalysis } from './useAudioAnalysis'

export function AnalysisDebugView() {
  const { start, stop, isRunning, lastFrame, error } = useAudioAnalysis()

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 16 }}>
      <button onClick={isRunning ? stop : start}>{isRunning ? 'Stop' : 'Start'}</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {lastFrame && (
        <pre>
          {JSON.stringify(
            {
              rms: lastFrame.rms.toFixed(4),
              pitch: `${lastFrame.pitch.toFixed(1)} Hz`,
              pitchConfidence: lastFrame.pitchConfidence.toFixed(2),
              onsetDetected: lastFrame.onsetDetected,
              onsetStrength: lastFrame.onsetStrength.toFixed(2),
              spectralCentroid: `${lastFrame.spectralCentroid.toFixed(1)} Hz`,
              hnr: `${lastFrame.hnr.toFixed(1)} dB`,
              voiceActive: lastFrame.voiceActive,
              fps: (44100 / 1024).toFixed(1),
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  )
}
