import { describe, expect, it } from "@jest/globals";

import {
  withGeneratedInsertDefaults,
  withGeneratedUuid,
} from "../../server/domains/agent/infrastructure/generated-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("withGeneratedUuid", () => {
  it("adds an app-generated UUID when an insert payload has no id", () => {
    const result = withGeneratedUuid({ orgId: "org-1", title: "Daily briefing" });

    expect(result).toMatchObject({ orgId: "org-1", title: "Daily briefing" });
    expect(result.id).toMatch(UUID_RE);
  });

  it("preserves an explicit id supplied by the caller", () => {
    const result = withGeneratedUuid({ id: "existing-id", orgId: "org-1" });

    expect(result.id).toBe("existing-id");
  });

  it("adds requested timestamp fields for SQLite-safe inserts", () => {
    const result = withGeneratedInsertDefaults({ orgId: "org-1" }, ["createdAt", "updatedAt"]);

    expect(result.id).toMatch(UUID_RE);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("preserves explicit timestamp values supplied by the caller", () => {
    const generatedAt = new Date("2026-06-08T00:00:00.000Z");
    const result = withGeneratedInsertDefaults({ orgId: "org-1", generatedAt }, ["generatedAt"]);

    expect(result.generatedAt).toBe(generatedAt);
  });
});
