import { promises as fsp } from "node:fs";
import path from "node:path";

/**
 * Phase 6: Atomic JSON file store with locking
 * Prevents race conditions during concurrent writes
 */
export class JsonStore<T> {
  private static locks = new Map<string, Promise<void>>();

  constructor(
    private filePath: string,
    private defaultValue: T
  ) {}

  private async ensureDir(): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  /**
   * Acquire file-level lock for atomic operations
   */
  private async withLock<R>(fn: () => Promise<R>): Promise<R> {
    const prev = JsonStore.locks.get(this.filePath) ?? Promise.resolve();
    let release!: () => void;
    const p = new Promise<void>((res) => (release = res));
    JsonStore.locks.set(
      this.filePath,
      prev.then(() => p)
    );

    try {
      await prev;
      return await fn();
    } finally {
      release();
      if (JsonStore.locks.get(this.filePath) === p) {
        JsonStore.locks.delete(this.filePath);
      }
    }
  }

  /**
   * Read JSON file, returning default if not found
   */
  async read(): Promise<T> {
    await this.ensureDir();
    try {
      const raw = await fsp.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return this.defaultValue;
    }
  }

  /**
   * Internal write without locking (for use within locked context)
   */
  private async writeInternal(obj: T): Promise<void> {
    await this.ensureDir();
    const tmp = `${this.filePath}.tmp`;
    const data = JSON.stringify(obj, null, 2);
    await fsp.writeFile(tmp, data, "utf8");
    await fsp.rename(tmp, this.filePath);
  }

  /**
   * Atomic write using temp file + rename
   */
  async write(obj: T): Promise<void> {
    await this.withLock(async () => {
      await this.writeInternal(obj);
    });
  }

  /**
   * Atomic read-modify-write operation
   * Prevents concurrent modification race conditions
   * Phase 6 FIX: Avoid deadlock by using writeInternal instead of write
   */
  async update(fn: (current: T) => T | Promise<T>): Promise<void> {
    await this.withLock(async () => {
      const current = await this.read();
      const updated = await fn(current);
      await this.writeInternal(updated); // Use internal method to avoid re-locking
    });
  }
}
