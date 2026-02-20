import crypto from "crypto";
import type { IStorage } from "../storage";
import type { UserApiKey } from "@shared/schema";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET must be set (min 32 chars) to use BYO key vault",
    );
  }
  return crypto.scryptSync(raw, "codedswitch-byo-salt", 32);
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptApiKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export function keyHint(plaintext: string): string {
  if (plaintext.length <= 4) return "****";
  return "****" + plaintext.slice(-4);
}

export type SupportedService = "elevenlabs" | "replicate";

const VALID_SERVICES: SupportedService[] = ["elevenlabs", "replicate"];

export function isValidService(service: string): service is SupportedService {
  return VALID_SERVICES.includes(service as SupportedService);
}

export class UserApiKeyService {
  constructor(private storage: IStorage) {}

  async listKeys(userId: string): Promise<Array<{ service: string; keyHint: string | null; isValid: boolean | null; lastUsedAt: Date | null; createdAt: Date | null }>> {
    const keys = await this.storage.getUserApiKeys(userId);
    return keys.map((k) => ({
      service: k.service,
      keyHint: k.keyHint,
      isValid: k.isValid,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }

  async storeKey(
    userId: string,
    service: SupportedService,
    plaintextKey: string,
  ): Promise<{ service: string; keyHint: string }> {
    const encrypted = encryptApiKey(plaintextKey);
    const hint = keyHint(plaintextKey);

    await this.storage.upsertUserApiKey(userId, {
      service,
      encryptedKey: encrypted,
      keyHint: hint,
    });

    return { service, keyHint: hint };
  }

  async getDecryptedKey(
    userId: string,
    service: SupportedService,
  ): Promise<string | null> {
    const record = await this.storage.getUserApiKey(userId, service);
    if (!record || !record.isValid) return null;
    try {
      return decryptApiKey(record.encryptedKey);
    } catch {
      await this.storage.upsertUserApiKey(userId, {
        service,
        encryptedKey: record.encryptedKey,
        keyHint: record.keyHint ?? undefined,
      });
      return null;
    }
  }

  async deleteKey(userId: string, service: SupportedService): Promise<void> {
    await this.storage.deleteUserApiKey(userId, service);
  }

  async markUsed(userId: string, service: SupportedService): Promise<void> {
    const record = await this.storage.getUserApiKey(userId, service);
    if (!record) return;
    await this.storage.upsertUserApiKey(userId, {
      service,
      encryptedKey: record.encryptedKey,
      keyHint: record.keyHint ?? undefined,
    });
  }

  async resolveKeys(
    userId: string,
    executionMode: "cloud" | "byo_keys",
  ): Promise<{ elevenlabsApiKey: string | null; replicateApiToken: string | null }> {
    if (executionMode === "cloud") {
      return {
        elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || null,
        replicateApiToken: process.env.REPLICATE_API_TOKEN || null,
      };
    }

    const elevenlabsApiKey = await this.getDecryptedKey(userId, "elevenlabs");
    const replicateApiToken = await this.getDecryptedKey(userId, "replicate");

    return { elevenlabsApiKey, replicateApiToken };
  }
}

let instance: UserApiKeyService | null = null;

export function getUserApiKeyService(storage: IStorage): UserApiKeyService {
  if (!instance) {
    instance = new UserApiKeyService(storage);
  }
  return instance;
}
