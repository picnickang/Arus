import { describe, expect, it } from "@jest/globals";
import { canRunPostgresBootstrapMigration } from "../../server/bootstrap/services";

describe("bootstrap local migration gate", () => {
  it("rejects SQLite runner handles without PostgreSQL-style execute", () => {
    expect(canRunPostgresBootstrapMigration({ run: async () => undefined })).toBe(false);
  });

  it("accepts database handles with execute for PostgreSQL bootstrap migrations", () => {
    expect(canRunPostgresBootstrapMigration({ execute: async () => ({ rows: [] }) })).toBe(
      true
    );
  });
});
