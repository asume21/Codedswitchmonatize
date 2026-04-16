// MUST be first import — patches window.Audio and AudioContext globally
import './lib/globalAudioKillSwitch';

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAudioDebugBridge } from './lib/audioDebugBridge';
import { startLongTaskMonitor } from './lib/perf/longTaskMonitor';

initAudioDebugBridge();

// Perf overlays are heavy under load and can compound stalls on a stressed
// machine. Opt in explicitly via:
//   localStorage.setItem('perf-debug','1')  // then reload
// Default OFF so the app stays stable.
if (typeof localStorage !== 'undefined' && localStorage.getItem('perf-debug') === '1') {
  startLongTaskMonitor();
}

createRoot(document.getElementById("root")!).render(<App />);
