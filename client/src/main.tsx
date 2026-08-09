// MUST be first import — patches window.Audio and AudioContext globally
import './lib/globalAudioKillSwitch';
// Second: patch the native Web Audio constructors so every node creation is
// counted before Tone.js (imported below via App) builds anything.
// Read with window.__nodeCensus() — see the file header for the method.
import './lib/audioNodeCensus';

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAudioDebugBridge } from './lib/audioDebugBridge';
import { startLongTaskMonitor } from './lib/perf/longTaskMonitor';
// AI Perception bridges — opt-in via URL params so they never run for regular users.
// Add ?webeye=1, ?websense=1, ?webnerve=1, ?webshield=1, or ?weblog=1 to activate.
const _sp = new URLSearchParams(window.location.search);
if (_sp.get('webeye')    === '1') import('./lib/webeyeBridge');
if (_sp.get('websense')  === '1') import('./lib/websenseBridge');
if (_sp.get('webnerve')  === '1') import('./lib/webnerveBridge');
if (_sp.get('webshield') === '1') import('./lib/webshieldBridge');
if (_sp.get('weblog')    === '1') import('./lib/weblogBridge');

initAudioDebugBridge();

// Perf overlays are heavy under load and can compound stalls on a stressed
// machine. Opt in explicitly via:
//   localStorage.setItem('perf-debug','1')  // then reload
// Default OFF so the app stays stable.
if (typeof localStorage !== 'undefined' && localStorage.getItem('perf-debug') === '1') {
  startLongTaskMonitor();
}

createRoot(document.getElementById("root")!).render(<App />);
