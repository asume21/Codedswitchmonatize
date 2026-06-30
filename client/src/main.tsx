// MUST be first import — patches window.Audio and AudioContext globally
import './lib/globalAudioKillSwitch';

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAudioDebugBridge } from './lib/audioDebugBridge';
import { startLongTaskMonitor } from './lib/perf/longTaskMonitor';
// AI Perception bridges (WebEye, WebSense, WebNerve, WebShield, WebLog) are
// opt-in developer snippets — do NOT auto-import here. Developers drop the
// relevant bridge script into their own app to activate a sensor.

initAudioDebugBridge();

// Perf overlays are heavy under load and can compound stalls on a stressed
// machine. Opt in explicitly via:
//   localStorage.setItem('perf-debug','1')  // then reload
// Default OFF so the app stays stable.
if (typeof localStorage !== 'undefined' && localStorage.getItem('perf-debug') === '1') {
  startLongTaskMonitor();
}

createRoot(document.getElementById("root")!).render(<App />);
