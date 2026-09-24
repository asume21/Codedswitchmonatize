import type { Express } from "express";
import { createServer } from "http";
import type { IStorage } from "./storage";
import { createAuthRoutes } from "./routes/auth";
import { createKeyRoutes } from "./routes/keys";
import { createSongRoutes } from "./routes/songs";
import { createCreditRoutes } from "./routes/credits";
import { createPackRoutes } from "./routes/packs";
import { createAIRoutes } from "./routes/ai";
import { createAudioRoutes } from "./routes/audio";
import { createMixRoutes } from "./routes/mix";
import { createLyricsRoutes } from "./routes/lyrics";
import { createAstutelyRoutes } from "./routes/astutely";
import { createSampleRoutes } from "./routes/samples";
import { createLoopRoutes } from "./routes/loops";
import { createUserRoutes } from "./routes/user";
import { createSocialRoutes } from "./routes/social";
import { createVulnerabilityRoutes } from "./routes/vulnerability";
import { createVoiceConvertRoutes } from "./routes/voiceConvert";
import { createLyricVideoRoutes } from "./routes/lyricVideo";
import { createStemGenerationRoutes } from "./routes/stemGeneration";
import { createSampleLibraryRoutes } from "./routes/sampleLibrary";
import { createBlogRouter } from "./routes/blog";
import { createAudioDebugRoutes } from "./routes/audioDebug";
import { createMcpApiRoutes } from "./routes/mcpApi";
import { createWebearKeyRoutes } from "./routes/webearKeys";
import {
  createWebearRelayRoutes,
  createWebeyeRelayRoutes,
  createWebsenseRelayRoutes,
  createWebnerveRelayRoutes,
  createWebshieldRelayRoutes,
  createWeblogRelayRoutes
} from "./routes/webearRelay";
import { createOrganismKitRoutes } from "./routes/organismKits";
import demoRoutes from "./routes/demo";
import { createAceStepRoutes } from "./routes/aceStep";
import { sessionRouter } from "./src/organism/sessionRouter";
import { profileRouter } from "./src/organism/profileRouter";
import { authLimiter } from "./middleware/rateLimiting";
import { createPublicInfoRoutes } from "./routes/publicInfo";
import { createFileServingRoutes } from "./routes/fileServing";
import { createAiChatRoutes } from "./routes/aiChat";
import { createMusicGenerationRoutes } from "./routes/musicGeneration";
import { createBillingRoutes } from "./routes/billing";
import { createMixingRoutes } from "./routes/mixing";
import { createAiOpsRoutes } from "./routes/aiOps";
import { createStemSeparationRoutes } from "./routes/stemSeparation";
import { createSecurityScanRoutes } from "./routes/securityScan";
import { createPlaylistRoutes } from "./routes/playlists";
import { createSpeechCorrectionRoutes } from "./routes/speechCorrection";
import { createVoiceRoutes } from "./routes/voices";
import { createAudioAnalysisRoutes } from "./routes/audioAnalysis";
import { createLibraryRoutes } from "./routes/library";
import { createTranscriptionRoutes } from "./routes/transcription";
import { createTrackRoutes } from "./routes/tracks";
import { createJamSessionRoutes } from "./routes/jamSessions";


export async function registerRoutes(app: Express, storage: IStorage) {
  app.use("/", createPublicInfoRoutes(storage));
  // Mount auth routes — uses its own limiter so /me session checks
  // on every page load don't count against the global 200-req budget.
  app.use("/api/auth", authLimiter, createAuthRoutes(storage));
  
  // Mount key activation routes
  app.use("/api/keys", createKeyRoutes(storage));
  
  // Mount song routes
  app.use("/api/songs", createSongRoutes(storage));
  
  // Mount credit routes
  app.use("/api/credits", createCreditRoutes(storage));

  // Mount pack routes
  app.use("/api/packs", createPackRoutes(storage));

  // Mount audio generation/rendering routes.
  // Backwards-compatible mount at /api so existing UI calls like /api/songs/generate-professional work.
  // Also mounted under /api/audio as the preferred, explicit namespace.
  const audioRouter = createAudioRoutes();
  app.use("/api", audioRouter);
  app.use("/api/audio", audioRouter);

  // Mount Mix Preview & Jobs routes
  app.use("/api", createMixRoutes());

  // Mount general AI routes (chat, provider selection)
  app.use("/api/ai", createAIRoutes());

  // Mount Lyric Lab routes — storage threaded through for requireCredits + CRUD
  app.use("/api/lyrics", createLyricsRoutes(storage));

  // Mount Astutely AI routes
  app.use("/api", createAstutelyRoutes(storage));

  // Mount Sample Library routes
  app.use("/api/samples", createSampleRoutes());

  app.use("/", createFileServingRoutes());
  // Mount Melodic Loop routes (real string/key/guitar loop packs for the
  // Organism loop layer). Public, like /api/samples.
  app.use("/api/loops", createLoopRoutes());

  // Mount User profile routes
  app.use("/api/user", createUserRoutes(storage));

  // Mount Social Hub routes
  app.use("/api/social", createSocialRoutes(storage));

  // Mount Blog routes
  app.use("/api/blog", createBlogRouter(storage));

  // Mount Vulnerability Scanner routes
  app.use("/api/vulnerability", createVulnerabilityRoutes(storage));

  // Mount Voice Conversion pipeline routes (jobs, BYO keys, cost check)
  app.use("/api/voice-convert", createVoiceConvertRoutes(storage));

  // Mount Lyric Video Maker transcode route (WebM → MP4 for social sharing)
  app.use("/api/lyric-video", createLyricVideoRoutes(storage));

  // Mount AI Stem Generation routes
  app.use("/api/stem-generation", createStemGenerationRoutes());

  // Mount Sample Library routes
  app.use("/api/sample-library", createSampleLibraryRoutes());

  // Mount Organism routes (Session Capture + Evolution Profile)
  app.use("/api/organism/sessions", sessionRouter);
  app.use("/api/organism/profile", profileRouter);
  app.use("/api/organism", createOrganismKitRoutes());

  // ACE-Step text-to-music generation (status, generate, job polling, audio serving)
  app.use("/api/ai-music", createAceStepRoutes());

  // Audio Debug Bridge — dev only, gives Claude Code ears
  if (process.env.NODE_ENV !== 'production') {
    app.use("/api/audio-debug", createAudioDebugRoutes());
  }

  // MCP Cloud API endpoints for monetization (legacy — kept for backward compat)
  app.use("/api/mcp", createMcpApiRoutes(storage));

  // Public demo endpoint — no auth, no credits. Powers the /demo page.
  app.use("/api/demo", demoRoutes);

  // WebEar API key management (generate, reveal, revoke)
  app.use("/api/webear-keys", createWebearKeyRoutes(storage));

  // WebEar relay + remote MCP SSE server (browser capture bridge + Claude Code MCP transport)
  app.use("/api/webear", createWebearRelayRoutes(storage));
  app.use("/api/webeye", createWebeyeRelayRoutes(storage));
  app.use("/api/websense", createWebsenseRelayRoutes(storage));
  app.use("/api/webnerve", createWebnerveRelayRoutes(storage));
  app.use("/api/webshield", createWebshieldRelayRoutes(storage));
  app.use("/api/weblog", createWeblogRelayRoutes(storage));

  app.use("/", createAiChatRoutes(storage));
  app.use("/", createMusicGenerationRoutes(storage));
  app.use("/", createBillingRoutes(storage));
  app.use("/", createMixingRoutes());
  app.use("/", createAiOpsRoutes());
  app.use("/", createStemSeparationRoutes());
  app.use("/", createSecurityScanRoutes());

  app.use("/", createPlaylistRoutes(storage));
  app.use("/", createSpeechCorrectionRoutes(storage));
  app.use("/", createVoiceRoutes(storage));
  app.use("/", createAudioAnalysisRoutes(storage));
  app.use("/", createLibraryRoutes(storage));
  // NOTE: /api/lyrics CRUD + /api/lyrics/{rhymes,analyze,generate,generate-beat,generate-music}
  // are owned by createLyricsRoutes() in server/routes/lyrics.ts (mounted above).
  // The prior inline handlers here were either (a) colocated duplicates or
  // (b) shadowed by the router — the shadowed versions had requireCredits
  // middleware that the router stubs lacked, causing a production credit-bypass
  // on the four paid endpoints. Unification fixed it. Do not re-add inline
  // /api/lyrics/* handlers; extend server/routes/lyrics.ts instead.

  app.use("/", createTranscriptionRoutes(storage));
  // ============================================
  // ASTUTELY AI BEAT GENERATOR
  // ============================================
  // NOTE: Astutely endpoint is now handled by createAstutelyRoutes() at line 132
  // which uses AI (Grok) for intelligent beat generation
  // The duplicate hardcoded endpoint has been removed to enable AI functionality

  app.use("/", createTrackRoutes(storage));
  app.use("/", createJamSessionRoutes(storage));

  return createServer(app);
}
