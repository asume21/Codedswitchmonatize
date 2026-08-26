import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import type { IStorage } from "../../storage";

/**
 * Regression: /my-voices turned EVERY failure into { success: true, voices: [] }
 * — no key, a rejected key, a network error. The page renders the voice picker
 * only when voices.length > 0, and useMyVoices reads only `data`, so an invalid
 * key did not produce an error anywhere: the dropdown simply ceased to exist.
 *
 * Real case (2026-08-22): an ElevenLabs key *ID* was saved instead of the key.
 * ElevenLabs answered 400 invalid_api_key, the route swallowed it, and the
 * control vanished with nothing on screen explaining why.
 *
 * The list stays a 200 with an empty array — a settings problem is not a failed
 * query — but the reason now rides along in `keyError` so the UI can say it.
 */

let fetchImpl: (...args: any[]) => Promise<any>;
vi.mock("node-fetch", () => ({ default: (...args: any[]) => fetchImpl(...args) }));

let decryptedKey: string | null = null;
vi.mock("../../services/userApiKeys", () => ({
  getUserApiKeyService: () => ({ getDecryptedKey: async () => decryptedKey }),
  isValidService: () => true,
}));

const { createVoiceConvertRoutes } = await import("../voiceConvert");

async function getMyVoices() {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).userId = "user-1";
    next();
  });
  app.use("/api/voice-convert", createVoiceConvertRoutes({} as unknown as IStorage));
  const server = await new Promise<any>((r) => { const s = app.listen(0, () => r(s)); });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/voice-convert/my-voices`);
  const body = await res.json() as any;
  server.close();
  return { status: res.status, body };
}

beforeEach(() => {
  decryptedKey = null;
  process.env.ELEVENLABS_API_KEY = "";
  fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ voices: [] }) });
});

describe("GET /my-voices", () => {
  it("explains a rejected key instead of reporting an empty voice list", async () => {
    decryptedKey = "d17ade-this-is-a-key-id-not-a-key";
    fetchImpl = async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        detail: { type: "authentication_error", code: "invalid_api_key", message: "API key ID used as API key" },
      }),
    });

    const { status, body } = await getMyVoices();
    expect(status).toBe(200);
    expect(body.voices).toEqual([]);
    expect(body.keyError).toContain("API key ID used as API key");
  });

  it("explains a missing key rather than silently returning nothing", async () => {
    const { body } = await getMyVoices();
    expect(body.voices).toEqual([]);
    expect(body.keyError).toMatch(/no elevenlabs api key/i);
  });

  it("explains an unreachable ElevenLabs", async () => {
    decryptedKey = "sk_valid_looking";
    fetchImpl = async () => { throw new Error("getaddrinfo ENOTFOUND api.elevenlabs.io"); };
    const { body } = await getMyVoices();
    expect(body.voices).toEqual([]);
    expect(body.keyError).toContain("ENOTFOUND");
  });

  it("returns voices with no keyError when the key works", async () => {
    decryptedKey = "sk_good";
    fetchImpl = async () => ({
      ok: true, status: 200,
      json: async () => ({ voices: [{ voice_id: "v1", name: "Roger", category: "premade" }] }),
    });
    const { body } = await getMyVoices();
    expect(body.voices).toHaveLength(1);
    expect(body.voices[0]).toMatchObject({ voiceId: "v1", name: "Roger" });
    expect(body.keyError).toBeUndefined();
  });
});
