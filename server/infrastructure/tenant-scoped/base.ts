/**
 * Tenant-Scoped Repository Base Class (ADR 001 Implementation)
 *
 * Provides defense-in-depth multi-tenant isolation by enforcing
 * immutable organization context at the repository layer.
 *
 * Key Principles:
 * 1. Immutable orgId - Cannot be changed after construction
 * 2. Type-safe - TypeScript ensures orgId is always present
 * 3. Defense-in-depth - Works with middleware validation
 * 4. Impossible to bypass - No optional parameters
 */

import { eq, and } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * Base class for all tenant-scoped repositories
 * Ensures orgId is always present and immutable
 */
export abstract class TenantScopedRepository {
  /**
   * Immutable organization ID
   * Set in constructor and cannot be modified
   */
  protected readonly orgId!: string;

  /**
   * Constructor enforces mandatory orgId
   * @param orgId - Organization ID (must not be null/undefined)
   * @throws Error if orgId is invalid
   */
  constructor(orgId: string) {
    if (!orgId || typeof orgId !== "string" || orgId.trim() === "") {
      throw new Error("TenantScopedRepository: orgId is required and must be a non-empty string");
    }

    const isDevelopment = process.env["NODE_ENV"] === "development";
    const FORBIDDEN_ORG_IDS = isDevelopment
      ? ["test-org-id", "placeholder-org-id"]
      : ["default-org-id", "test-org-id", "placeholder-org-id"];

    if (FORBIDDEN_ORG_IDS.includes(orgId)) {
      throw new Error("TenantScopedRepository: Hard-coded default org IDs are not allowed");
    }

    Object.defineProperty(this, "orgId", {
      value: orgId,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }

  /**
   * Helper: Build org-scoped WHERE clause
   * Automatically adds orgId filter to all queries
   */
  protected orgWhere<T extends PgTable>(
    table: T,
    additionalWhere?: import("drizzle-orm").SQL | undefined,
    orgIdColumn: string = "orgId"
  ) {
    if (!(table as object as Record<string, unknown>)[orgIdColumn]) {
      throw new Error(
        `TenantScopedRepository: Table does not have column '${orgIdColumn}'. ` +
          `Available columns: ${Object.keys(table).join(", ")}`
      );
    }

    const orgFilter = eq((table as object as Record<string, never>)[orgIdColumn]!, this.orgId);
    return additionalWhere ? and(orgFilter, additionalWhere) : orgFilter;
  }

  /**
   * Validate that an entity belongs to this organization
   * Throws error if entity has different orgId
   */
  protected validateOwnership(entity: { orgId: string }, entityType: string): void {
    if (entity.orgId !== this.orgId) {
      throw new Error(
        `Tenant isolation violation: ${entityType} belongs to org ${entity.orgId}, ` +
          `but repository is scoped to org ${this.orgId}`
      );
    }
  }

  /**
   * Get current organization ID
   * Read-only accessor
   */
  public getOrgId(): string {
    return this.orgId;
  }
}
