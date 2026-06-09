import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());
const POSTGRES_STORE = resolve(
  REPO_ROOT,
  "server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts"
);
const OBJECT_MEDIA_STORE = resolve(
  REPO_ROOT,
  "server/domains/vessel-diagram-registry/infrastructure/object-storage-media-store.ts"
);
const SCHEMA = resolve(REPO_ROOT, "shared/schema/vessel-diagram-registry.ts");
const MIGRATION = resolve(REPO_ROOT, "migrations/0037_vessel_diagram_version_publish_metadata.sql");

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function functionBody(file: string, name: string): string {
  const marker = file.indexOf(`async ${name}(`);
  expect(marker).toBeGreaterThanOrEqual(0);
  const nextMethod = file.indexOf("\n  async ", marker + 1);
  return nextMethod === -1 ? file.slice(marker) : file.slice(marker, nextMethod);
}

describe("vessel diagram postgres store contract", () => {
  it("maps and persists diagram version publish metadata", () => {
    const store = source(POSTGRES_STORE);
    const schema = source(SCHEMA);
    const migration = source(MIGRATION);

    expect(store).toContain("publishedBy: row.publishedBy ?? null");
    expect(store).toContain("publishedAt: row.publishedAt ?? null");
    expect(schema).toContain('publishedAt: timestamp("published_at"');
    expect(schema).toContain('publishedBy: varchar("published_by")');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "published_by"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "published_at"');
  });

  it("serializes version creation and active-version publishing inside transactions", () => {
    const store = source(POSTGRES_STORE);
    const addVersion = functionBody(store, "addVersion");
    const setActiveVersion = functionBody(store, "setActiveVersion");

    expect(addVersion).toContain("return db.transaction(async (tx)");
    expect(addVersion).toContain('.for("update")');
    expect(addVersion).toMatch(/tx\s*\.insert\(vesselDiagramVersions\)/);
    expect(setActiveVersion).toContain("return db.transaction(async (tx)");
    expect(setActiveVersion).toContain('.for("update")');
    expect(setActiveVersion).toContain("ne(vesselDiagramVersions.id, versionId)");
    expect(setActiveVersion).toContain('status: "superseded"');
    expect(setActiveVersion).toContain('status: "active"');
    expect(setActiveVersion).toContain("publishedBy: ctx.userId");
    expect(setActiveVersion).toContain("publishedAt");
  });

  it("keeps polygon replacement atomic", () => {
    const store = source(POSTGRES_STORE);
    const replaceSectionPolygon = functionBody(store, "replaceSectionPolygon");

    expect(replaceSectionPolygon).toContain("await db.transaction(async (tx)");
    expect(replaceSectionPolygon).toMatch(/tx\s*\.delete\(vesselSectionPolygons\)/);
    expect(replaceSectionPolygon).toContain("tx.insert(vesselSectionPolygons)");
  });

  it("awaits quota accounting and logs quota failures after media persistence", () => {
    const mediaStore = source(OBJECT_MEDIA_STORE);

    expect(mediaStore).toContain("await quotaService.incrementUsage");
    expect(mediaStore).toContain("logger.warn");
  });
});
