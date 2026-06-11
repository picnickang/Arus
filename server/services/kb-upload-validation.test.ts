import { afterEach, describe, expect, it } from "@jest/globals";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  KB_ALLOWED_UPLOAD_MIME_TYPES,
  isAllowedKbUploadMimeType,
  validateMagicBytesFromBuffer,
  validateMagicBytesFromPath,
} from "./kb-upload-validation";

const samples = {
  pdf: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
  text: Buffer.from("<html><script>alert('x')</script></html>"),
};

const tempFiles: string[] = [];

async function writeTempFile(buffer: Buffer): Promise<string> {
  const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kb-upload-validation-"));
  const filePath = path.join(dir, "upload.bin");
  await fsPromises.writeFile(filePath, buffer);
  tempFiles.push(filePath, dir);
  return filePath;
}

afterEach(async () => {
  for (const filePath of tempFiles.splice(0).reverse()) {
    await fsPromises.rm(filePath, { recursive: true, force: true });
  }
});

describe("kb upload validation", () => {
  it("accepts only the supported KB upload MIME types", () => {
    expect(KB_ALLOWED_UPLOAD_MIME_TYPES).toEqual(["application/pdf", "image/png", "image/jpeg"]);
    expect(isAllowedKbUploadMimeType("application/pdf")).toBe(true);
    expect(isAllowedKbUploadMimeType("image/png")).toBe(true);
    expect(isAllowedKbUploadMimeType("image/jpeg")).toBe(true);
    expect(isAllowedKbUploadMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedKbUploadMimeType("text/html")).toBe(false);
  });

  it("accepts matching PDF, PNG, and JPEG magic bytes from memory buffers", () => {
    expect(validateMagicBytesFromBuffer(samples.pdf, "application/pdf")).toBe(true);
    expect(validateMagicBytesFromBuffer(samples.png, "image/png")).toBe(true);
    expect(validateMagicBytesFromBuffer(samples.jpeg, "image/jpeg")).toBe(true);
  });

  it("rejects spoofed, truncated, empty, and unsupported in-memory uploads", () => {
    expect(validateMagicBytesFromBuffer(samples.text, "application/pdf")).toBe(false);
    expect(validateMagicBytesFromBuffer(samples.png, "image/jpeg")).toBe(false);
    expect(validateMagicBytesFromBuffer(Buffer.from([0xff, 0xd8]), "image/jpeg")).toBe(false);
    expect(validateMagicBytesFromBuffer(Buffer.alloc(0), "image/png")).toBe(false);
    expect(validateMagicBytesFromBuffer(samples.png, "image/svg+xml")).toBe(false);
  });

  it("validates matching signatures from staged async-upload files", async () => {
    const pdfPath = await writeTempFile(samples.pdf);
    const pngPath = await writeTempFile(samples.png);
    const jpegPath = await writeTempFile(samples.jpeg);

    await expect(validateMagicBytesFromPath(pdfPath, "application/pdf")).resolves.toBe(true);
    await expect(validateMagicBytesFromPath(pngPath, "image/png")).resolves.toBe(true);
    await expect(validateMagicBytesFromPath(jpegPath, "image/jpeg")).resolves.toBe(true);
  });

  it("rejects staged files when content does not match the declared type", async () => {
    const htmlPath = await writeTempFile(samples.text);
    const truncatedPath = await writeTempFile(Buffer.from([0x25, 0x50]));

    await expect(validateMagicBytesFromPath(htmlPath, "application/pdf")).resolves.toBe(false);
    await expect(validateMagicBytesFromPath(truncatedPath, "application/pdf")).resolves.toBe(false);
    await expect(validateMagicBytesFromPath(htmlPath, "text/html")).resolves.toBe(false);
  });
});
