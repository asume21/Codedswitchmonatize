import { useState, useCallback } from 'react';

interface MasteringMeasurements {
  peakLevel: number;
  rmsLevel: number;
  frequencyData: { bass: number; mids: number; highs: number };
}

interface UseMasteringAnalyzerReturn extends MasteringMeasurements {
  isAnalyzing: boolean;
  analyze: () => Promise<void>;
}

export function useMasteringAnalyzer(): UseMasteringAnalyzerReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [peakLevel, setPeakLevel]     = useState(-3);
  const [rmsLevel, setRmsLevel]       = useState(-12);
  const [frequencyData, setFrequencyData] = useState<{ bass: number; mids: number; highs: number }>({
    bass: -12, mids: -15, highs: -18,
  });

  const analyze = useCallback(async () => {
    const audioDebug = (window as any).__audioDebug;
    if (!audioDebug?.startCapture) return;

    setIsAnalyzing(true);
    try {
      const captureId: string = await audioDebug.startCapture(3000);

      const res = await fetch(`/api/webear/analyze-app/${captureId}`);
      if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);

      const report = await res.json();

      // Map AudioAnalysisReport fields to AIMasteringCard props
      // peakDb → peakLevel, rmsDb → rmsLevel
      // bandEnergy: { sub, bass, lowMid, highMid, high } → bass/mids/highs
      if (typeof report.peakDb === 'number')  setPeakLevel(report.peakDb);
      if (typeof report.rmsDb === 'number')   setRmsLevel(report.rmsDb);

      const bands = report.bandEnergy;
      if (bands) {
        // band energy values are 0–1 fractions; convert to dB-like scale for the AI
        const toDb = (frac: number) => frac > 0 ? Math.max(-60, 20 * Math.log10(frac)) : -60;
        setFrequencyData({
          bass:  toDb((bands.bass ?? 0) + (bands.sub ?? 0)),
          mids:  toDb(((bands.lowMid ?? 0) + (bands.highMid ?? 0)) / 2),
          highs: toDb(bands.high ?? 0),
        });
      }
    } catch (err) {
      console.warn('[useMasteringAnalyzer] capture/analyze failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { peakLevel, rmsLevel, frequencyData, isAnalyzing, analyze };
}
