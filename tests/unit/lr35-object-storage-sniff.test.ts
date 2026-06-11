/**
 * LR-3.5 / OBJ-2 regression: magic-byte sniff + safe content-type
 * selection forces attachment when the claimed type and the sniffed
 * type disagree, and when the claimed type is in a known-hostile
 * family.
 */
import { sniffMimeFamily, pickSafeContentType } from "../../server/objectStorage";

describe("LR-3.5 OBJ-2 — sniffMimeFamily", () => {
  it("recognises JPEG / PNG / PDF / GLB / WebP / ZIP", () => {
    expect(sniffMimeFamily(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMimeFamily(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png"
    );
    expect(sniffMimeFamily(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMimeFamily(Buffer.from("glTF\x02\x00\x00\x00"))).toBe("model/gltf-binary");
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(sniffMimeFamily(webp)).toBe("image/webp");
    expect(sniffMimeFamily(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("application/zip");
  });

  it("flags HTML/text payloads as 'text'", () => {
    expect(sniffMimeFamily(Buffer.from("<html><script>alert(1)</script></html>"))).toBe("text");
  });

  it("returns 'unknown' for empty / binary garbage", () => {
    expect(sniffMimeFamily(Buffer.alloc(0))).toBe("unknown");
    expect(sniffMimeFamily(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBe("unknown");
  });
});

describe("LR-3.5 OBJ-2 — pickSafeContentType", () => {
  it("honours matching JPEG", () => {
    expect(pickSafeContentType("image/jpeg", "image/jpeg")).toEqual({
      safeContentType: "image/jpeg",
      forceAttachment: false,
    });
  });

  it("forces attachment when HTML masquerades as JPEG", () => {
    // Attacker uploads HTML with Content-Type: image/jpeg.
    expect(pickSafeContentType("image/jpeg", "text")).toEqual({
      safeContentType: "application/octet-stream",
      forceAttachment: true,
    });
  });

  it("never honours text/html, image/svg, application/javascript, xml", () => {
    for (const hostile of [
      "text/html",
      "image/svg+xml",
      "application/javascript",
      "text/javascript",
      "application/xml",
      "text/xml",
      "application/xhtml+xml",
    ]) {
      const out = pickSafeContentType(hostile, "text");
      expect(out.forceAttachment).toBe(true);
      expect(out.safeContentType).toBe("application/octet-stream");
    }
  });

  it("honours PDF / GLB / DOCX (ZIP family) when sniff agrees", () => {
    expect(pickSafeContentType("application/pdf", "application/pdf").forceAttachment).toBe(false);
    expect(pickSafeContentType("model/gltf-binary", "model/gltf-binary").forceAttachment).toBe(
      false
    );
    expect(
      pickSafeContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip"
      ).forceAttachment
    ).toBe(false);
  });
});
