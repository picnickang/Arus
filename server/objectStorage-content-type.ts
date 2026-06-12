/**
 * LR-3.5 / OBJ-2: extremely small magic-byte sniffer covering the
 * file families this app stores (images, audio/video, PDFs, GLB, ZIP,
 * Office). Returns a coarse "family" string used by
 * `pickSafeContentType` to decide whether to honour the claimed
 * Content-Type or force a safe one. Kept inline (no new dep) - we
 * only need to distinguish safe families from "everything else".
 */
export function sniffMimeFamily(head: Buffer): string {
  if (head.length === 0) {
    return "unknown";
  }
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF
  if (
    head.slice(0, 6).toString("ascii") === "GIF87a" ||
    head.slice(0, 6).toString("ascii") === "GIF89a"
  ) {
    return "image/gif";
  }
  // WebP (RIFF....WEBP)
  if (
    head.slice(0, 4).toString("ascii") === "RIFF" &&
    head.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // PDF
  if (head.slice(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }
  // GLB (glTF binary)
  if (head.slice(0, 4).toString("ascii") === "glTF") {
    return "model/gltf-binary";
  }
  // ZIP family (covers .zip, .docx, .xlsx, .pptx)
  if (
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)
  ) {
    return "application/zip";
  }
  // MP4 (ftyp box at offset 4)
  if (head.slice(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4";
  }
  // OGG
  if (head.slice(0, 4).toString("ascii") === "OggS") {
    return "audio/ogg";
  }
  // MP3 (ID3 or sync frame)
  if (head.slice(0, 3).toString("ascii") === "ID3") {
    return "audio/mpeg";
  }
  if (head[0] === 0xff && head[1] !== undefined && (head[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  // Text-looking head (HTML/SVG/XML/JSON/plain) - return generic
  // "text" so pickSafeContentType can force attachment defensively.
  const printable = head
    .slice(0, 64)
    .every((b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e));
  if (printable) {
    return "text";
  }
  return "unknown";
}

const SAFE_MIME_FAMILIES: ReadonlyArray<{ prefix: string; sniffed: ReadonlyArray<string> }> = [
  { prefix: "image/jpeg", sniffed: ["image/jpeg"] },
  { prefix: "image/png", sniffed: ["image/png"] },
  { prefix: "image/gif", sniffed: ["image/gif"] },
  { prefix: "image/webp", sniffed: ["image/webp"] },
  { prefix: "application/pdf", sniffed: ["application/pdf"] },
  { prefix: "model/gltf-binary", sniffed: ["model/gltf-binary"] },
  { prefix: "video/mp4", sniffed: ["video/mp4"] },
  { prefix: "audio/mpeg", sniffed: ["audio/mpeg"] },
  { prefix: "audio/ogg", sniffed: ["audio/ogg"] },
  // ZIP-family (.docx, .xlsx, .pptx) - all sniff as application/zip.
  { prefix: "application/zip", sniffed: ["application/zip"] },
  {
    prefix: "application/vnd.openxmlformats-officedocument.",
    sniffed: ["application/zip"],
  },
  { prefix: "application/vnd.ms-", sniffed: ["application/zip"] },
];

export function pickSafeContentType(
  claimed: string,
  sniffed: string
): { safeContentType: string; forceAttachment: boolean } {
  const lower = claimed.toLowerCase();
  // Hostile families: never honour them, always force attachment.
  if (
    lower.startsWith("text/html") ||
    lower.startsWith("image/svg") ||
    lower.startsWith("application/xhtml") ||
    lower.startsWith("application/javascript") ||
    lower.startsWith("text/javascript") ||
    lower.startsWith("application/xml") ||
    lower.startsWith("text/xml")
  ) {
    return { safeContentType: "application/octet-stream", forceAttachment: true };
  }

  for (const entry of SAFE_MIME_FAMILIES) {
    if (lower.startsWith(entry.prefix) && entry.sniffed.includes(sniffed)) {
      return { safeContentType: claimed, forceAttachment: false };
    }
  }

  // Claimed type is not in the safe-list, or the sniff disagrees.
  // Serve as an opaque attachment.
  return { safeContentType: "application/octet-stream", forceAttachment: true };
}
