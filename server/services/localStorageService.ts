import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import fs from "fs";
import path from "path";

export interface StorageSaveResult {
  url: string;
  path: string;
}

export interface StorageService {
  saveJson(kind: string, id: string, data: unknown): Promise<StorageSaveResult>;
  saveAudio(buffer: Buffer, ext: string): Promise<StorageSaveResult>;
}

const DATA_ROOT = process.env.DATA_ROOT || path.resolve(process.cwd(), "data");

export class LocalStorageService implements StorageService {
  private dataRoot: string;
  private jsonRoot: string;
  private audioRoot: string;

  constructor(rootDir: string = DATA_ROOT) {
    this.dataRoot = rootDir;
    this.jsonRoot = path.join(this.dataRoot, "json");
    this.audioRoot = path.join(this.dataRoot, "audio");
  }

  private async ensureDir(dirPath: string) {
    await mkdir(dirPath, { recursive: true });
  }

  async saveJson(kind: string, id: string, data: unknown): Promise<StorageSaveResult> {
    const targetDir = path.join(this.jsonRoot, kind);
    await this.ensureDir(targetDir);

    const filename = `${id}.json`;
    const filePath = path.join(targetDir, filename);
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

    return {
      path: filePath,
      url: `/data/json/${kind}/${filename}`,
    };
  }

  async saveAudio(buffer: Buffer, ext: string): Promise<StorageSaveResult> {
    const sanitizedExt = ext.startsWith(".") ? ext.slice(1) : ext;
    const targetDir = this.audioRoot;
    await this.ensureDir(targetDir);

    const filename = `${randomUUID()}.${sanitizedExt}`;
    const filePath = path.join(targetDir, filename);
    await writeFile(filePath, buffer);

    return {
      path: filePath,
      url: `/data/audio/${filename}`,
    };
  }
}

export function ensureDataRoots(rootDir: string = DATA_ROOT) {
  const jsonDir = path.join(rootDir, "json");
  const audioDir = path.join(rootDir, "audio");

  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
}
