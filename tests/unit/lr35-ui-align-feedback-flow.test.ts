/**
 * UI Align Phase 5 — Feedback / Flag Issue Flow (task #189).
 *
 * Asserts:
 *   - Validation rules live in the application layer
 *     (`feedback-submission.ts`) and block invalid submissions.
 *   - Successful submissions write through the same module
 *     (sessionStorage path), with a `pendingBackend` flag — no
 *     pretend network success.
 *   - The Phase 5 field set (location, severity pills, photo
 *     placeholder) is wired in the React page WITHOUT moving
 *     validation into the component.
 *   - The stable `empty-feedback-history` empty-state id is
 *     preserved (cross-surface contract).
 *
 * Same Jest harness constraint as the other LR-3.5 client-side
 * tests: `testEnvironment: "node"` with the swc/ESM transform —
 * no React mount. We exercise the application module directly and
 * source-scan the page for the contract bits that can't be reached
 * without rendering.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FEEDBACK_LOCATION_OPTIONS,
  FEEDBACK_PHOTO_MAX_BYTES,
  listSessionFeedback,
  submitFeedback,
  validateFeedback,
  validatePhotoForFeedback,
  type FeedbackDraft,
} from "../../client/src/application/feedback/feedback-submission";

const REPO_ROOT = resolve(__dirname, "..", "..");
const PAGE_PATH = resolve(REPO_ROOT, "client/src/pages/feedback.tsx");

const VALID_DRAFT: FeedbackDraft = {
  category: "bug",
  severity: "high",
  location: "engine_room",
  subject: "Bilge pump 2 noise",
  description: "Bilge pump 2 is making unusual noise and temperature is above normal.",
  photo: null,
};

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
}

describe("UI Align Phase 5 — feedback-submission application contract", () => {
  beforeEach(() => {
    (globalThis as { sessionStorage?: Storage }).sessionStorage =
      new MemoryStorage() as unknown as Storage;
  });

  describe("validateFeedback (pure)", () => {
    it("blocks submission when subject is too short", () => {
      const errors = validateFeedback({ ...VALID_DRAFT, subject: "ab" });
      expect(errors.some((e) => e.field === "subject")).toBe(true);
    });

    it("blocks submission when description is too short", () => {
      const errors = validateFeedback({ ...VALID_DRAFT, description: "short" });
      expect(errors.some((e) => e.field === "description")).toBe(true);
    });

    it("blocks submission when location is not a known option", () => {
      const errors = validateFeedback({
        ...VALID_DRAFT,
        // Force an unknown location through the type system to exercise
        // the runtime guard.
        location: "lunar_module" as unknown as FeedbackDraft["location"],
      });
      expect(errors.some((e) => e.field === "location")).toBe(true);
    });

    it("accepts every shipped location option", () => {
      for (const opt of FEEDBACK_LOCATION_OPTIONS) {
        const errors = validateFeedback({ ...VALID_DRAFT, location: opt.value });
        expect(errors.find((e) => e.field === "location")).toBeUndefined();
      }
    });

    it("accepts a fully valid Phase 5 draft", () => {
      expect(validateFeedback(VALID_DRAFT)).toEqual([]);
    });
  });

  describe("submitFeedback (sessionStorage path, no network)", () => {
    it("returns ok+pendingBackend and writes the entry to sessionStorage", async () => {
      const result = await submitFeedback(VALID_DRAFT);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.pendingBackend).toBe(true);
      expect(typeof result.trackingId).toBe("string");
      expect(result.trackingId.length).toBeGreaterThan(3);

      const stored = sessionStorage.getItem("arus-pilot-feedback-outbox");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        category: "bug",
        severity: "high",
        location: "engine_room",
        subject: VALID_DRAFT.subject,
        description: VALID_DRAFT.description,
      });
      expect(parsed[0].trackingId).toBe(result.trackingId);
    });

    it("returns ok=false WITHOUT writing storage when the draft fails validation", async () => {
      const result = await submitFeedback({
        ...VALID_DRAFT,
        subject: "x",
        description: "y",
      });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.errors.length).toBeGreaterThan(0);
      expect(sessionStorage.getItem("arus-pilot-feedback-outbox")).toBeNull();
    });

    it("persists photo metadata but strips the previewUrl (sessionStorage budget)", async () => {
      const photoDraft: FeedbackDraft = {
        ...VALID_DRAFT,
        photo: {
          name: "engine.jpg",
          sizeBytes: 12345,
          mimeType: "image/jpeg",
          previewUrl: "data:image/jpeg;base64,AAAA",
        },
      };
      const result = await submitFeedback(photoDraft);
      expect(result.ok).toBe(true);
      const stored = JSON.parse(
        sessionStorage.getItem("arus-pilot-feedback-outbox")!,
      );
      expect(stored[0].photo).toMatchObject({
        name: "engine.jpg",
        sizeBytes: 12345,
        mimeType: "image/jpeg",
      });
      expect(stored[0].photo.previewUrl).toBe("");
    });

    it("listSessionFeedback returns newest-first", async () => {
      await submitFeedback({ ...VALID_DRAFT, subject: "first entry" });
      await submitFeedback({ ...VALID_DRAFT, subject: "second entry" });
      const list = listSessionFeedback();
      expect(list).toHaveLength(2);
      expect(list[0].subject).toBe("second entry");
      expect(list[1].subject).toBe("first entry");
    });
  });

  describe("validatePhotoForFeedback (application-layer policy)", () => {
    it("rejects non-image MIME types", () => {
      const result = validatePhotoForFeedback({
        name: "doc.pdf",
        sizeBytes: 100,
        mimeType: "application/pdf",
        previewUrl: "data:application/pdf;base64,AAAA",
      });
      expect(result.ok).toBe(false);
    });

    it("rejects files over the 5 MB cap", () => {
      const result = validatePhotoForFeedback({
        name: "big.jpg",
        sizeBytes: FEEDBACK_PHOTO_MAX_BYTES + 1,
        mimeType: "image/jpeg",
        previewUrl: "data:image/jpeg;base64,AAAA",
      });
      expect(result.ok).toBe(false);
    });

    it("rejects an unusable preview URL", () => {
      const result = validatePhotoForFeedback({
        name: "ok.jpg",
        sizeBytes: 1024,
        mimeType: "image/jpeg",
        previewUrl: "",
      });
      expect(result.ok).toBe(false);
    });

    it("accepts a valid image under the cap with a data: preview", () => {
      const result = validatePhotoForFeedback({
        name: "ok.jpg",
        sizeBytes: 1024,
        mimeType: "image/jpeg",
        previewUrl: "data:image/jpeg;base64,AAAA",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.photo.name).toBe("ok.jpg");
      expect(result.photo.mimeType).toBe("image/jpeg");
    });
  });

  describe("listSessionFeedback normalisation (forward/backward compat)", () => {
    it("defaults a legacy entry (no location field) to 'other'", () => {
      const legacy = [{
        trackingId: "FB-LEGACY",
        createdAt: new Date().toISOString(),
        category: "bug",
        severity: "low",
        subject: "old entry",
        description: "description long enough to pass the guard",
      }];
      sessionStorage.setItem(
        "arus-pilot-feedback-outbox",
        JSON.stringify(legacy),
      );
      const list = listSessionFeedback();
      expect(list).toHaveLength(1);
      expect(list[0].location).toBe("other");
    });

    it("normalises a tampered/unknown location string to 'other'", () => {
      const tampered = [{
        trackingId: "FB-T",
        createdAt: new Date().toISOString(),
        category: "bug",
        severity: "low",
        subject: "tampered entry",
        description: "description long enough to pass the guard",
        location: "lunar_module",
      }];
      sessionStorage.setItem(
        "arus-pilot-feedback-outbox",
        JSON.stringify(tampered),
      );
      const list = listSessionFeedback();
      expect(list).toHaveLength(1);
      expect(list[0].location).toBe("other");
    });

    it("drops corrupt rows that miss the base shape", () => {
      const mixed = [
        { trackingId: "ok", createdAt: "x", category: "bug", severity: "low", subject: "s", description: "long enough description", location: "engine_room" },
        { totally: "wrong" },
      ];
      sessionStorage.setItem(
        "arus-pilot-feedback-outbox",
        JSON.stringify(mixed),
      );
      const list = listSessionFeedback();
      expect(list).toHaveLength(1);
      expect(list[0].subject).toBe("s");
    });
  });
});

describe("UI Align Phase 5 — feedback page wiring (source-scan)", () => {
  it("imports validation + submission from the application module, not inline", async () => {
    const src = await readFile(PAGE_PATH, "utf8");
    expect(src).toContain(
      'from "@/application/feedback/feedback-submission"',
    );
    // The component must NOT redefine the validation rules. Pin the
    // absence of the well-known rule strings — they only live in the
    // application module.
    expect(src).not.toMatch(/Subject must be at least/);
    expect(src).not.toMatch(/Description must be at least/);
  });

  it("calls submitFeedback exactly once from the page (no parallel direct sessionStorage write)", async () => {
    const src = await readFile(PAGE_PATH, "utf8");
    const submitCalls = src.match(/submitFeedback\(/g) ?? [];
    expect(submitCalls.length).toBe(1);
    // The page must NOT write directly to sessionStorage — that path
    // belongs to feedback-submission.ts. The page may still read via
    // listSessionFeedback (which is the application-layer reader).
    expect(src).not.toMatch(/sessionStorage\.setItem/);
  });

  it("renders the Phase 5 field set: severity pills, location select, photo placeholder", async () => {
    const src = await readFile(PAGE_PATH, "utf8");
    expect(src).toContain('data-testid="group-feedback-severity"');
    // Pill testids are constructed via template literal
    // `pill-feedback-severity-${opt.value}` against SEVERITY_OPTIONS.
    expect(src).toContain("pill-feedback-severity-");
    expect(src).toMatch(/value:\s*"low"/);
    expect(src).toMatch(/value:\s*"medium"/);
    expect(src).toMatch(/value:\s*"high"/);
    expect(src).toContain('data-testid="select-feedback-location"');
    expect(src).toContain('data-testid="input-feedback-photo"');
    expect(src).toContain('data-testid="button-feedback-photo-pick"');
    // Submit button uses the panel-3 copy
    expect(src).toMatch(/Submit Report/);
    // Title matches panel 3 ("Report an Issue")
    expect(src).toMatch(/Report an Issue/);
    // Success state matches mobile panel ("Issue submitted")
    expect(src).toMatch(/Issue submitted/);
  });

  it("preserves the empty-feedback-history stable id", async () => {
    const src = await readFile(PAGE_PATH, "utf8");
    expect(src).toContain('data-testid="empty-feedback-history"');
  });

  it("does NOT pretend a photo upload network request succeeded", async () => {
    const src = await readFile(PAGE_PATH, "utf8");
    // No fetch / apiRequest / axios call for the photo placeholder.
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/apiRequest\(/);
    // No fake progress bar driven by a setInterval.
    expect(src).not.toMatch(/setInterval\(/);
  });

  it("keeps SwitchPortalButton visible (user-portal contract)", async () => {
    const src = await readFile(PAGE_PATH, "utf8");
    expect(src).toContain("SwitchPortalButton");
  });
});
