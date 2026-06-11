/**
 * Feedback Review (office triage) — contract pins.
 *
 * Asserts:
 *   - `pilotFeedbackReviewSchema` only admits the office-side states
 *     (acknowledged/resolved) with bounded note length, and supports
 *     `linkedWorkOrderId: null` as an explicit "clear the link".
 *   - Both /api/feedback-review endpoints are role-gated
 *     (requireFeedbackReviewRole) — this surface must never be reachable
 *     by user-portal roles.
 *   - The new prefix is registered in the envelope manifest so responses
 *     ship in the canonical envelope like every other /api surface.
 *   - The client page is admin-guarded (App.tsx ADMIN_ONLY_ROUTES), talks
 *     through apiRequest (raw-fetch ratchet), and keeps its stable testids.
 *
 * Node-env source-scan harness — same constraint as the other lr35 tests
 * (no React mount under @swc/jest with tsx: false).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { pilotFeedbackReviewSchema } from "../../shared/schema/feedback";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

describe("pilotFeedbackReviewSchema (office review payload)", () => {
  it("accepts an acknowledge action with no extras", () => {
    const parsed = pilotFeedbackReviewSchema.parse({ status: "acknowledged" });
    expect(parsed).toEqual({ status: "acknowledged" });
  });

  it("accepts a resolve action with note and linked work order", () => {
    const parsed = pilotFeedbackReviewSchema.parse({
      status: "resolved",
      resolutionNote: "Replaced the bilge sensor; WO raised.",
      linkedWorkOrderId: "wo-123",
    });
    expect(parsed.status).toBe("resolved");
    expect(parsed.linkedWorkOrderId).toBe("wo-123");
  });

  it("accepts linkedWorkOrderId: null as an explicit clear", () => {
    const parsed = pilotFeedbackReviewSchema.parse({
      status: "resolved",
      linkedWorkOrderId: null,
    });
    expect(parsed.linkedWorkOrderId).toBeNull();
  });

  it("rejects crew-only / unknown statuses", () => {
    expect(pilotFeedbackReviewSchema.safeParse({ status: "submitted" }).success).toBe(false);
    expect(pilotFeedbackReviewSchema.safeParse({ status: "in_progress" }).success).toBe(false);
  });

  it("rejects an over-long resolution note", () => {
    const result = pilotFeedbackReviewSchema.safeParse({
      status: "resolved",
      resolutionNote: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty-string work order id (must be null or a real id)", () => {
    const result = pilotFeedbackReviewSchema.safeParse({
      status: "resolved",
      linkedWorkOrderId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("review endpoints are role-gated and enveloped", () => {
  it("both /api/feedback-review routes sit behind requireFeedbackReviewRole", async () => {
    const source = await readFile(resolve(REPO_ROOT, "server/domains/me-portal/routes.ts"), "utf8");
    const getRoute = source.match(
      /app\.get\(\s*"\/api\/feedback-review",[\s\S]*?withErrorHandling/
    );
    const patchRoute = source.match(
      /app\.patch\(\s*"\/api\/feedback-review\/:id",[\s\S]*?withErrorHandling/
    );
    expect(getRoute?.[0]).toContain("requireFeedbackReviewRole");
    expect(patchRoute?.[0]).toContain("requireFeedbackReviewRole");
    // User-portal roles must never appear in the review role set.
    const roles = source.match(/FEEDBACK_REVIEW_ROLES = \[[\s\S]*?\]/)?.[0] ?? "";
    expect(roles).not.toContain("deck_officer");
    expect(roles).not.toContain("viewer");
  });

  it("the prefix is registered in the envelope manifest", async () => {
    const manifest = await readFile(resolve(REPO_ROOT, "server/lib/envelope-manifest.ts"), "utf8");
    expect(manifest).toContain('"/api/feedback-review"');
  });
});

describe("feedback-review page contract", () => {
  it("is admin-guarded (ADMIN_ONLY_ROUTES) and the guard is wired in App.tsx", async () => {
    const navConfig = await readFile(
      resolve(REPO_ROOT, "client/src/config/navigationConfig.ts"),
      "utf8"
    );
    const guard = navConfig.match(/ADMIN_ONLY_ROUTES = new Set<string>\(\[[\s\S]*?\]\)/)?.[0] ?? "";
    expect(guard).toContain('"/feedback-review"');
    const app = await readFile(resolve(REPO_ROOT, "client/src/App.tsx"), "utf8");
    expect(app).toContain("ADMIN_ONLY_ROUTES.has(path)");
  });

  it("uses apiRequest (no raw fetch) and keeps its stable testids", async () => {
    const page = await readFile(resolve(REPO_ROOT, "client/src/pages/feedback-review.tsx"), "utf8");
    const dialog = await readFile(
      resolve(REPO_ROOT, "client/src/pages/feedback-review/ResolveDialog.tsx"),
      "utf8"
    );
    for (const source of [page, dialog]) {
      expect(source).not.toMatch(/[^.\w]fetch\(/);
    }
    expect(page).toContain('queryKey: ["/api/feedback-review"]');
    expect(page).toContain('data-testid="page-feedback-review"');
    expect(page).toContain("pill-feedback-filter-");
    expect(page).toContain("button-ack-");
    expect(page).toContain("button-resolve-");
    expect(dialog).toContain('data-testid="dialog-feedback-resolve"');
    expect(dialog).toContain('data-testid="input-resolution-note"');
    expect(dialog).toContain('data-testid="select-resolve-wo"');
    expect(dialog).toContain('data-testid="button-resolve-confirm"');
  });
});
