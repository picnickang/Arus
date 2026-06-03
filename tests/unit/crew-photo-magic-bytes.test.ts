/**
 * Crew profile photo — magic-byte validation (pure-logic verification).
 *
 * The crew photo upload route (POST /api/crew/:id/photo) trusts neither the
 * client-supplied filename nor its Content-Type: multer's fileFilter only
 * sees the spoofable mimetype, so the route re-checks the actual leading
 * bytes of the payload with `validateImageMagicBytes` before streaming it to
 * object storage. This test pins that gate directly — no browser, no network,
 * runs in the sandbox.
 *
 * What this DOES verify:
 *  - Real PNG / JPEG signatures pass for their declared mimetype.
 *  - A correct signature paired with the WRONG declared mimetype is rejected
 *    (signature/mimetype must agree).
 *  - Disallowed mimetypes (gif, svg, pdf) are rejected outright.
 *  - Truncated / empty / mismatched buffers are rejected.
 *  - `isAllowedImageMimeType` is the single source of truth for the allow-list.
 */

import { describe, it, expect } from "@jest/globals";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  isAllowedImageMimeType,
  validateImageMagicBytes,
} from "../../server/lib/image-magic-bytes.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("isAllowedImageMimeType", () => {
  it("accepts exactly png and jpeg", () => {
    expect([...ALLOWED_IMAGE_MIME_TYPES].sort()).toEqual(["image/jpeg", "image/png"]);
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
  });

  it("rejects every other mimetype", () => {
    for (const mime of ["image/gif", "image/svg+xml", "image/webp", "application/pdf", "text/html", ""]) {
      expect(isAllowedImageMimeType(mime)).toBe(false);
    }
  });
});

describe("validateImageMagicBytes", () => {
  it("accepts a real PNG buffer declared as image/png", () => {
    expect(validateImageMagicBytes(PNG_SIGNATURE, "image/png")).toBe(true);
  });

  it("accepts a real JPEG buffer declared as image/jpeg", () => {
    expect(validateImageMagicBytes(JPEG_SIGNATURE, "image/jpeg")).toBe(true);
  });

  it("rejects a PNG buffer declared as image/jpeg (signature/mimetype mismatch)", () => {
    expect(validateImageMagicBytes(PNG_SIGNATURE, "image/jpeg")).toBe(false);
  });

  it("rejects a JPEG buffer declared as image/png (signature/mimetype mismatch)", () => {
    expect(validateImageMagicBytes(JPEG_SIGNATURE, "image/png")).toBe(false);
  });

  it("rejects an allowed mimetype whose bytes are not an image", () => {
    const notAnImage = Buffer.from("<svg>not really a png</svg>", "utf8");
    expect(validateImageMagicBytes(notAnImage, "image/png")).toBe(false);
  });

  it("rejects a disallowed mimetype even with valid-looking bytes", () => {
    expect(validateImageMagicBytes(PNG_SIGNATURE, "image/gif")).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(validateImageMagicBytes(Buffer.alloc(0), "image/png")).toBe(false);
  });

  it("rejects a buffer too short to contain the full signature", () => {
    expect(validateImageMagicBytes(Buffer.from([0x89, 0x50]), "image/png")).toBe(false);
  });
});
