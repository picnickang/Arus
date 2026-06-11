/**
 * System-admin bootstrap service used by the local-only `/setup` route.
 *
 * Centralizing these reads/writes inside the system-admin domain preserves
 * hexagonal modularity: the route layer no longer reaches into
 * `dbSystemAdminStorage` directly. The `dbSystemAdminStorage` import here is
 * intra-domain and therefore allowed by the domain leak guard.
 */

import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";

function normalizeSettingValue(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && "hash" in value) {
    const hash = (value as { hash?: unknown }).hash;
    return typeof hash === "string" ? hash : undefined;
  }
  return String(value);
}

export interface UpsertSetupSettingOptions {
  isSecret?: boolean;
  description?: string;
}

export async function getSetupSetting(category: string, key: string): Promise<string | undefined> {
  const setting = await dbSystemAdminStorage.getAdminSystemSetting(DEFAULT_ORG_ID, category, key);
  return normalizeSettingValue(setting?.value);
}

export async function upsertSetupSetting(
  category: string,
  key: string,
  value: string,
  options: UpsertSetupSettingOptions = {}
): Promise<void> {
  const existing = await dbSystemAdminStorage.getAdminSystemSetting(DEFAULT_ORG_ID, category, key);
  const payload = {
    orgId: DEFAULT_ORG_ID,
    category,
    key,
    value,
    dataType: "string" as const,
    isSecret: options.isSecret ?? false,
    description: options.description,
  };

  if (existing?.id) {
    await dbSystemAdminStorage.updateAdminSystemSetting(existing.id, payload);
    return;
  }

  await dbSystemAdminStorage.createAdminSystemSetting(payload);
}
