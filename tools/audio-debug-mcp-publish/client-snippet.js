/**
 * webear — Browser Client Snippet
 *
 * Drop this into any web app to enable AI audio capture.
 * Framework-agnostic — works with any AudioContext, Tone.js, Howler.js, etc.
 *
 * USAGE (script tag):
 *   <script src="node_modules/webear/client-snippet.js"></script>
 *   <script>
 *     // Auto-init: taps the default AudioContext destination
 *     WebEar.init()
 *
 *     // Or with a specific AudioContext:
 *     WebEar.init({ audioContext: myAudioContext })
 *
 *     // Or with Tone.js:
 *     WebEar.init({ toneJs: true })
 *   </script>
 *
 * USAGE (ES module):
 *   import { WebEar } from 'webear/client'
 *   WebEar.init()
 *
 * The bridge will:
 *   1. Connect to your dev server via SSE (/api/webear/events)
 *   2. Listen for capture commands from the MCP server
 *   3. Record audio from your AudioContext using MediaRecorder
 *   4. Upload the recorded WebM blob back to the dev server
 *
 * The MCP server then retrieves and analyzes the audio.
 *
 * REQUIREMENTS:
 *   - Your Express server must have the webear middleware mounted
 *   - The browser must support MediaRecorder (all modern browsers do)
 *   - Audio must be playing through an AudioContext
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.WebEar = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var BRIDGE_BASE = '/api/webear';
  var tapNode = null;
  var recorder = null;
  var sseSource = null;
  var lastCaptureId = null;
  var isCapturing = false;
  var isConnected = false;
  var audioCtx = null;

  function log(msg) {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[webear] ' + msg);
    }
  }

  function getOrCreateAudioContext() {
    if (audioCtx) return audioCtx;

    // Try to get an existing AudioContext from common sources
    if (typeof Tone !== 'undefined' && Tone.getContext) {
      try {
        var toneCtx = Tone.getContext();
        audioCtx = toneCtx.rawContext || toneCtx;
        log('Using Tone.js AudioContext');
        return audioCtx;
      } catch (e) { /* fall through */ }
    }

    if (typeof Howler !== 'undefined' && Howler.ctx) {
      audioCtx = Howler.ctx;
      log('Using Howler.js AudioContext');
      return audioCtx;
    }

    // Last resort: create a new one
    if (typeof AudioContext !== 'undefined') {
      audioCtx = new AudioContext();
      log('Created new AudioContext');
    } else if (typeof webkitAudioContext !== 'undefined') {
      audioCtx = new webkitAudioContext();
      log('Created new webkitAudioContext');
    }

    return audioCtx;
  }

  function getOutputNode() {
    // Try Tone.js master output first
    if (typeof Tone !== 'undefined' && Tone.getDestination) {
      try {
        var dest = Tone.getDestination();
        if (dest && dest.output && dest.output._gainNode) {
          log('Tapping Tone.js master gain node');
          return dest.output._gainNode;
        }
      } catch (e) { /* fall through */ }
    }

    // Fall back to AudioContext.destination
    var ctx = getOrCreateAudioContext();
    if (ctx && ctx.destination) {
      log('Tapping AudioContext.destination');
      return ctx.destination;
    }

    return null;
  }

  function ensureTap() {
    if (tapNode) return tapNode;

    var ctx = getOrCreateAudioContext();
    if (!ctx) {
      log('Warning: no AudioContext available. Cannot create tap.');
      return null;
    }

    tapNode = ctx.createMediaStreamDestination();

    var output = getOutputNode();
    if (output && output !== ctx.destination) {
      // Connect the output node to our tap (side-channel)
      try {
        output.connect(tapNode);
        log('Tap connected to output node');
      } catch (e) {
        log('Warning: could not connect tap — ' + e.message);
      }
    } else if (ctx.destination) {
      // For raw AudioContext, we need the user to route audio through a gain node
      // that we can tap. We'll create an AnalyserNode as a proxy.
      log('Warning: connected to AudioContext.destination directly. ' +
          'For best results, route your audio through a GainNode and pass it to init().');

      // Try to intercept by creating a new destination chain
      try {
        var masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        masterGain.connect(tapNode);
        // Store for users to connect their audio to
        WebEar._masterGain = masterGain;
        log('Created master gain tap — connect your audio nodes to WebEar._masterGain');
      } catch (e) {
        log('Warning: could not create master gain tap — ' + e.message);
      }
    }

    return tapNode;
  }

  function doCapture(captureId, durationMs) {
    if (isCapturing) {
      log('Capture ' + captureId + ' skipped — already capturing');
      return Promise.resolve();
    }

    isCapturing = true;
    lastCaptureId = captureId;

    var tap = ensureTap();
    if (!tap) {
      isCapturing = false;
      log('Capture ' + captureId + ' failed — no tap node available');
      return Promise.resolve();
    }

    // Retry tap connection if needed
    var output = getOutputNode();
    if (output && output !== getOrCreateAudioContext().destination) {
      try { output.connect(tap); } catch (e) { /* already connected */ }
    }

    var mimeType = 'audio/webm';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
    }

    var chunks = [];
    recorder = new MediaRecorder(tap.stream, { mimeType: mimeType });

    recorder.ondataavailable = function (e) {
      if (e.data.size > 0) chunks.push(e.data);
    };

    log('Starting capture ' + captureId + ' for ' + durationMs + 'ms');

    return new Promise(function (resolve) {
      recorder.onstop = function () {
        var blob = new Blob(chunks, { type: mimeType });
        log('Capture ' + captureId + ' complete — ' + blob.size + ' bytes, posting to server');

        var form = new FormData();
        form.append('audio', blob, 'capture.webm');
        form.append('captureId', captureId);
        form.append('durationMs', String(durationMs));

        fetch(BRIDGE_BASE + '/capture', { method: 'POST', body: form })
          .then(function () { log('Capture ' + captureId + ' uploaded'); })
          .catch(function (err) { log('Upload failed: ' + err.message); })
          .finally(function () {
            isCapturing = false;
            resolve();
          });
      };

      recorder.start(200);
      setTimeout(function () {
        if (recorder && recorder.state === 'recording') recorder.stop();
      }, durationMs);
    });
  }

  function connectSSE() {
    if (sseSource) return;
    if (typeof EventSource === 'undefined') {
      log('EventSource not supported in this environment');
      return;
    }

    sseSource = new EventSource(BRIDGE_BASE + '/events');

    sseSource.onopen = function () {
      isConnected = true;
      log('SSE connected');

      // Drain any commands that arrived while disconnected
      fetch(BRIDGE_BASE + '/pending-commands')
        .then(function (r) { return r.json(); })
        .then(function (cmds) {
          cmds.forEach(function (cmd) {
            if (cmd.type === 'capture') doCapture(cmd.captureId, cmd.durationMs);
          });
        })
        .catch(function () {});
    };

    sseSource.addEventListener('capture', function (e) {
      var cmd = JSON.parse(e.data);
      doCapture(cmd.captureId, cmd.durationMs);
    });

    sseSource.onerror = function () {
      isConnected = false;
      if (sseSource) sseSource.close();
      sseSource = null;
      setTimeout(connectSSE, 3000);
    };
  }

  // ── Public API ──────────────────────────────────────────────────────

  var WebEar = {
    _masterGain: null,

    /**
     * Initialize the audio debug bridge.
     *
     * @param {Object} [options]
     * @param {AudioContext} [options.audioContext] - Provide your own AudioContext
     * @param {AudioNode} [options.outputNode] - The node to tap (e.g. master gain)
     * @param {boolean} [options.toneJs] - Auto-detect Tone.js context
     * @param {string} [options.bridgeBase] - Override the API base path (default: /api/webear)
     * @param {boolean} [options.devOnly] - Only init in development (default: true)
     */
    init: function (options) {
      options = options || {};

      // Dev-only guard
      if (options.devOnly !== false) {
        var isDev = (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
                    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') ||
                    (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
        if (!isDev) {
          log('Skipping init — not in dev mode. Set devOnly: false to override.');
          return;
        }
      }

      if (options.bridgeBase) {
        BRIDGE_BASE = options.bridgeBase;
      }

      if (options.audioContext) {
        audioCtx = options.audioContext;
      }

      if (options.outputNode) {
        var ctx = getOrCreateAudioContext();
        if (ctx) {
          tapNode = ctx.createMediaStreamDestination();
          try {
            options.outputNode.connect(tapNode);
            log('Tap connected to provided output node');
          } catch (e) {
            log('Warning: could not connect tap to provided node — ' + e.message);
          }
        }
      }

      connectSSE();
      ensureTap();

      // Expose on window for console testing
      if (typeof window !== 'undefined') {
        window.__webear = {
          startCapture: function (durationMs) {
            var captureId = crypto.randomUUID();
            return doCapture(captureId, durationMs || 3000).then(function () {
              return captureId;
            });
          },
          getLastCaptureId: function () { return lastCaptureId; },
          status: function () {
            return isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected';
          },
        };
      }

      log('WebEar initialised. window.__webear is available.');
    },

    /**
     * Manually trigger a capture (useful for testing from the console).
     * @param {number} [durationMs=3000]
     * @returns {Promise<string>} The capture ID
     */
    capture: function (durationMs) {
      var captureId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'cap-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      return doCapture(captureId, durationMs || 3000).then(function () {
        return captureId;
      });
    },

    /**
     * Get the current bridge status.
     * @returns {'connected'|'disconnected'|'capturing'}
     */
    status: function () {
      return isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected';
    },

    /**
     * Disconnect SSE and clean up.
     */
    destroy: function () {
      if (sseSource) { sseSource.close(); sseSource = null; }
      if (recorder && recorder.state === 'recording') recorder.stop();
      isConnected = false;
      isCapturing = false;
      tapNode = null;
      recorder = null;
      log('WebEar destroyed');
    },
  };

  return WebEar;
}));
