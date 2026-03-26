// MUST be first import — patches window.Audio and AudioContext globally
import './lib/globalAudioKillSwitch';

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAudioDebugBridge } from './lib/audioDebugBridge';

initAudioDebugBridge();

createRoot(document.getElementById("root")!).render(<App />);
