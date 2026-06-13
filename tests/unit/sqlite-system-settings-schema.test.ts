import { describe, expect, it } from "@jest/globals";

import { systemSettingsSqlite } from "../../shared/schema-sqlite-vessel";
import { systemSettings } from "../../shared/schema-runtime-tables-operations";

describe("SQLite system settings schema", () => {
  it("exposes the local system_settings table required by boot-time settings checks", () => {
    expect(systemSettingsSqlite).toBeDefined();
    expect(systemSettingsSqlite.id).toBeDefined();
    expect(systemSettingsSqlite.hmacRequired).toBeDefined();
    expect(systemSettingsSqlite.openaiApiKeyEncrypted).toBeDefined();
  });

  it("uses a SQLite-compatible system settings table in local mode instead of a cloud-only undefined table", () => {
    expect(systemSettings).toBeDefined();
    expect(systemSettings.id).toBeDefined();
    expect(systemSettings.hmacRequired).toBeDefined();
    expect(systemSettings.openaiApiKeyEncrypted).toBeDefined();
  });
});
