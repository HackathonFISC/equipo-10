import fs from "node:fs/promises";
import path from "node:path";

export interface StorageService {
  save(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

export class LocalFileStorageService implements StorageService {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), "storage");
  }

  private resolvePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/\\/g, "/").replace(/\.\./g, "");
    return path.join(this.baseDir, safeKey);
  }

  async save(key: string, data: Buffer): Promise<void> {
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async get(key: string): Promise<Buffer | null> {
    const fullPath = this.resolvePath(key);
    try {
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
