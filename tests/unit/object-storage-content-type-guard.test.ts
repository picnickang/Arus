/**
 * Stored-XSS defence: object downloads magic-byte-sniff every object and
 * force a safe `application/octet-stream` + attachment whenever an
 * uploader's claimed Content-Type disagrees with the real bytes, or when
 * the file looks like an executable web type (HTML/SVG/JS/XML).
 *
 * These two pure functions are the whole protection, so they are pinned
 * here exhaustively: a future refactor that silently weakens either one
 * (e.g. dropping a hostile prefix, or honouring a mismatched claim) must
 * break this test.
 */
import { sniffMimeFamily, pickSafeContentType } from "../../server/objectStorage";

function withFtyp(brand = "isom"): Buffer {
  const buf = Buffer.alloc(12);
  buf.write("ftyp", 4, "ascii");
  buf.write(brand, 8, "ascii");
  return buf;
}

function webpHead(): Buffer {
  const buf = Buffer.alloc(12);
  buf.write("RIFF", 0, "ascii");
  buf.write("WEBP", 8, "ascii");
  return buf;
}

describe("sniffMimeFamily — known-safe families", () => {
  it("recognises JPEG", () => {
    expect(sniffMimeFamily(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it("recognises PNG", () => {
    expect(sniffMimeFamily(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png"
    );
  });

  it("recognises GIF (87a and 89a)", () => {
    expect(sniffMimeFamily(Buffer.from("GIF87a"))).toBe("image/gif");
    expect(sniffMimeFamily(Buffer.from("GIF89a"))).toBe("image/gif");
  });

  it("recognises WebP (RIFF....WEBP)", () => {
    expect(sniffMimeFamily(webpHead())).toBe("image/webp");
  });

  it("recognises PDF", () => {
    expect(sniffMimeFamily(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("recognises GLB (glTF binary)", () => {
    expect(sniffMimeFamily(Buffer.from("glTF\x02\x00\x00\x00"))).toBe("model/gltf-binary");
  });

  it("recognises ZIP family (zip/docx/xlsx/pptx)", () => {
    expect(sniffMimeFamily(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("application/zip");
    expect(sniffMimeFamily(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe("application/zip");
    expect(sniffMimeFamily(Buffer.from([0x50, 0x4b, 0x07, 0x08]))).toBe("application/zip");
  });

  it("recognises MP4 (ftyp box at offset 4)", () => {
    expect(sniffMimeFamily(withFtyp())).toBe("video/mp4");
  });

  it("recognises OGG", () => {
    expect(sniffMimeFamily(Buffer.from("OggS\x00\x02"))).toBe("audio/ogg");
  });

  it("recognises MP3 (ID3 tag and raw sync frame)", () => {
    expect(sniffMimeFamily(Buffer.from("ID3\x03\x00"))).toBe("audio/mpeg");
    expect(sniffMimeFamily(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe("audio/mpeg");
  });
});

describe("sniffMimeFamily — text / unknown fallbacks", () => {
  it("classifies printable payloads (HTML/SVG/JS/XML/JSON/plain) as 'text'", () => {
    expect(sniffMimeFamily(Buffer.from("<html><script>alert(1)</script></html>"))).toBe("text");
    expect(sniffMimeFamily(Buffer.from('<svg onload="alert(1)"></svg>'))).toBe("text");
    expect(sniffMimeFamily(Buffer.from("alert(document.cookie)"))).toBe("text");
    expect(sniffMimeFamily(Buffer.from('<?xml version="1.0"?><a/>'))).toBe("text");
    expect(sniffMimeFamily(Buffer.from('{"key":"value"}'))).toBe("text");
    expect(sniffMimeFamily(Buffer.from("plain text body"))).toBe("text");
  });

  it("returns 'unknown' for empty buffers", () => {
    expect(sniffMimeFamily(Buffer.alloc(0))).toBe("unknown");
  });

  it("returns 'unknown' for non-printable binary garbage", () => {
    expect(sniffMimeFamily(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x7f, 0x80]))).toBe("unknown");
  });
});

describe("pickSafeContentType — hostile claimed types always force attachment", () => {
  const hostile = [
    "text/html",
    "text/html; charset=utf-8",
    "image/svg+xml",
    "application/xhtml+xml",
    "application/javascript",
    "text/javascript",
    "application/xml",
    "text/xml",
  ];

  for (const claimed of hostile) {
    it(`forces attachment for ${claimed} regardless of sniff`, () => {
      // Even if the bytes themselves looked benign, the claim is hostile.
      const out = pickSafeContentType(claimed, "image/png");
      expect(out).toEqual({
        safeContentType: "application/octet-stream",
        forceAttachment: true,
      });
    });
  }

  it("is case-insensitive on the claimed type", () => {
    expect(pickSafeContentType("TEXT/HTML", "text").forceAttachment).toBe(true);
    expect(pickSafeContentType("Image/SVG+XML", "image/png").forceAttachment).toBe(true);
  });
});

describe("pickSafeContentType — matching safe claim + sniff is served as-is", () => {
  const safePairs: Array<[string, string]> = [
    ["image/jpeg", "image/jpeg"],
    ["image/png", "image/png"],
    ["image/gif", "image/gif"],
    ["image/webp", "image/webp"],
    ["application/pdf", "application/pdf"],
    ["model/gltf-binary", "model/gltf-binary"],
    ["video/mp4", "video/mp4"],
    ["audio/mpeg", "audio/mpeg"],
    ["audio/ogg", "audio/ogg"],
    ["application/zip", "application/zip"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
    ["application/vnd.ms-excel", "application/zip"],
  ];

  for (const [claimed, sniffed] of safePairs) {
    it(`honours ${claimed} when sniff agrees (${sniffed})`, () => {
      expect(pickSafeContentType(claimed, sniffed)).toEqual({
        safeContentType: claimed,
        forceAttachment: false,
      });
    });
  }
});

describe("pickSafeContentType — mismatches force attachment", () => {
  it("forces attachment when HTML masquerades as image/jpeg", () => {
    expect(pickSafeContentType("image/jpeg", "text")).toEqual({
      safeContentType: "application/octet-stream",
      forceAttachment: true,
    });
  });

  it("forces attachment when claimed safe type disagrees with sniff", () => {
    expect(pickSafeContentType("image/png", "image/jpeg").forceAttachment).toBe(true);
    expect(pickSafeContentType("application/pdf", "application/zip").forceAttachment).toBe(true);
    expect(pickSafeContentType("video/mp4", "unknown").forceAttachment).toBe(true);
  });

  it("forces attachment for a claimed type not in the safe-list", () => {
    expect(pickSafeContentType("application/octet-stream", "image/jpeg").forceAttachment).toBe(
      true
    );
    expect(pickSafeContentType("", "image/png").forceAttachment).toBe(true);
  });
});
