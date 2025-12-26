import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface TunerModalProps {
  open: boolean;
  onClose: () => void;
  freq: number;
  setFreq: (n: number) => void;
}

export function TunerModal({ open, onClose, freq, setFreq }: TunerModalProps) {
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (open) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.gain.value = 0.05;
      oscRef.current = ctxRef.current.createOscillator();
      oscRef.current.frequency.value = freq;
      oscRef.current.connect(gainRef.current).connect(ctxRef.current.destination);
      oscRef.current.start();
    } else {
      oscRef.current?.stop();
      oscRef.current = null;
      gainRef.current = null;
      ctxRef.current?.close();
      ctxRef.current = null;
    }
    return () => {
      oscRef.current?.stop();
      oscRef.current = null;
      gainRef.current = null;
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (oscRef.current) {
      oscRef.current.frequency.value = freq;
    }
  }, [freq]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Reference Tone</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <span>Frequency</span>
            <Input
              type="number"
              className="w-24 bg-gray-800 border-gray-700"
              value={freq}
              onChange={(e) => setFreq(Number(e.target.value))}
            />
            <span>Hz</span>
          </div>
          <Slider
            value={[freq]}
            onValueChange={(v) => setFreq(v[0])}
            min={220}
            max={880}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Adjust to match your instrument’s tuning.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
