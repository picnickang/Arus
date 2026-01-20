/**
 * Shared types and utilities for domain-specific storage adapters
 */

export interface StorageAdapter<T, TInsert> {
  getAll(orgId: string, filters?: Record<string, unknown>): Promise<T[]>;
  getById(id: string, orgId: string): Promise<T | undefined>;
  create(data: TInsert): Promise<T>;
  update(id: string, data: Partial<TInsert>, orgId: string): Promise<T>;
  delete(id: string, orgId: string): Promise<void>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DateRangeFilter {
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface OrgScopedFilter {
  orgId: string;
  vesselId?: string;
}

/**
 * Validates that orgId is provided for multi-tenant operations
 * CRITICAL: Prevents data leakage across organizations
 */
export function validateOrgId(orgId: string | undefined, operation: string): asserts orgId is string {
  if (!orgId || orgId.trim() === "") {
    throw new Error(
      `[Security] orgId is required for ${operation}. This is a critical multi-tenant isolation error.`
    );
  }
}

/**
 * Creates a standardized timestamp for record creation/updates
 */
export function now(): Date {
  return new Date();
}

/**
 * Storage broadcast event types
 */
export type BroadcastAction = "create" | "update" | "delete";

/**
 * Interface for WebSocket broadcast functionality
 * Decouples storage from specific WebSocket implementation
 */
export interface BroadcastService {
  broadcastCrewChange?(action: BroadcastAction, data: unknown): void;
  broadcastVesselChange?(action: BroadcastAction, data: unknown): void;
  broadcastEquipmentChange?(action: BroadcastAction, data: unknown): void;
  broadcastWorkOrderChange?(action: BroadcastAction, data: unknown): void;
}

/**
 * Gets broadcast service instance if available
 * Returns null if WebSocket server is not initialized
 */
export function getBroadcastService(): BroadcastService | null {
  try {
    const { getWebSocketServer } = require("../../websocket");
    return getWebSocketServer() as BroadcastService | null;
  } catch {
    return null;
  }
}
