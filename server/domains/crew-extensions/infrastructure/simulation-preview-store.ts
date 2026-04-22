/**
 * In-Memory Simulation Preview Store
 * Stores simulation previews temporarily for SIMULATE mode
 * Previews expire after a configurable TTL (default 30 minutes)
 */

import type { ISimulationPreviewStore } from '../domain/ports.js';
import type { SimulationPreview } from '../domain/types.js';
import { createLogger } from '../../../lib/structured-logger.js';

const logger = createLogger('SimulationPreviewStore');

const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface StoredPreview {
  preview: SimulationPreview;
  orgId: string;
  createdAt: number;
}

class InMemorySimulationPreviewStore implements ISimulationPreviewStore {
  private previews = new Map<string, StoredPreview>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private ttlMs: number = DEFAULT_TTL_MS) {
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.deleteExpired().catch((err) => {
        logger.error('[SimulationPreviewStore] Cleanup error:', err);
      });
    }, 60 * 1000);
  }

  async save(preview: SimulationPreview): Promise<void> {
    const existing = await this.getLatest(preview.orgId);
    if (existing && existing.previewId !== preview.previewId) {
      await this.delete(existing.previewId, preview.orgId);
      logger.info('[SimulationPreviewStore] Superseded previous preview', {
        previousId: existing.previewId,
        newId: preview.previewId,
        orgId: preview.orgId,
      });
    }

    this.previews.set(preview.previewId, {
      preview,
      orgId: preview.orgId,
      createdAt: Date.now(),
    });

    logger.info('[SimulationPreviewStore] Saved preview', {
      previewId: preview.previewId,
      orgId: preview.orgId,
      proposedCount: preview.proposedAssignments.length,
      expiresAt: preview.expiresAt.toISOString(),
    });
  }

  async get(previewId: string, orgId: string): Promise<SimulationPreview | undefined> {
    const stored = this.previews.get(previewId);
    if (!stored) {return undefined;}

    if (stored.orgId !== orgId) {
      logger.warn('[SimulationPreviewStore] Org mismatch on preview access', {
        previewId,
        requestedOrgId: orgId,
        actualOrgId: stored.orgId,
      });
      return undefined;
    }

    if (new Date() > stored.preview.expiresAt) {
      this.previews.delete(previewId);
      return undefined;
    }

    return stored.preview;
  }

  async getLatest(orgId: string): Promise<SimulationPreview | undefined> {
    let latest: StoredPreview | undefined;

    for (const stored of this.previews.values()) {
      if (stored.orgId !== orgId) {continue;}
      if (new Date() > stored.preview.expiresAt) {continue;}
      if (!latest || stored.createdAt > latest.createdAt) {
        latest = stored;
      }
    }

    return latest?.preview;
  }

  async delete(previewId: string, orgId: string): Promise<boolean> {
    const stored = this.previews.get(previewId);
    if (!stored || stored.orgId !== orgId) {return false;}

    this.previews.delete(previewId);
    logger.info('[SimulationPreviewStore] Deleted preview', { previewId, orgId });
    return true;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [previewId, stored] of this.previews.entries()) {
      if (now > stored.preview.expiresAt) {
        this.previews.delete(previewId);
        count++;
      }
    }

    if (count > 0) {
      logger.info('[SimulationPreviewStore] Cleaned expired previews', { count });
    }

    return count;
  }

  getStats(): { total: number; byOrg: Map<string, number> } {
    const byOrg = new Map<string, number>();
    for (const stored of this.previews.values()) {
      byOrg.set(stored.orgId, (byOrg.get(stored.orgId) || 0) + 1);
    }
    return { total: this.previews.size, byOrg };
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const simulationPreviewStore = new InMemorySimulationPreviewStore();
