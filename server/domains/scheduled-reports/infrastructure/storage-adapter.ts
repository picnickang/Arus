/**
 * Report Storage Adapter
 * File system storage for generated reports
 */

import fs from "fs/promises";
import path from "path";
import type { IReportStorageAdapter } from "../domain/ports.js";
import { logger } from "../../../utils/logger.js";

const LOG_CTX = "ReportStorageAdapter";
const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export class ReportStorageAdapter implements IReportStorageAdapter {
  private initialized = false;

  private async ensureDirectory(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await fs.mkdir(REPORTS_DIR, { recursive: true });
      this.initialized = true;
    } catch (error) {
      logger.error(LOG_CTX, "Failed to create reports directory", String(error));
      throw error;
    }
  }

  async save(filename: string, content: Buffer): Promise<string> {
    await this.ensureDirectory();

    const filePath = path.join(REPORTS_DIR, filename);
    await fs.writeFile(filePath, content);

    logger.info(LOG_CTX, `Saved report: ${filename} (${content.length} bytes)`);
    return filePath;
  }

  async load(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      logger.error(LOG_CTX, `Failed to load report: ${filePath}`, String(error));
      throw new Error(`Report not found: ${filePath}`);
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info(LOG_CTX, `Deleted report: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.error(LOG_CTX, `Failed to delete report: ${filePath}`, String(error));
      }
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
