/**
 * Single-Tenant Configuration
 *
 * Centralized configuration for single-tenant mode to prevent drift across modules.
 * All modules should import DEFAULT_ORG_ID from this file.
 */

export const DEFAULT_ORG_ID = "default-org-id";

export const TENANT_CONFIG = {
  orgId: DEFAULT_ORG_ID,
  slug: "default",
  name: "Default Organization",
} as const;
