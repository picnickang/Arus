import fsPromises from "node:fs/promises";

export const KB_ALLOWED_UPLOAD_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export type KbAllowedUploadMimeType = (typeof KB_ALLOWED_UPLOAD_MIME_TYPES)[number];

const MAGIC_BYTES: Record<KbAllowedUploadMimeType, ReadonlyArray<number>> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

export function isAllowedKbUploadMimeType(mimetype: string): mimetype is KbAllowedUploadMimeType {
  return KB_ALLOWED_UPLOAD_MIME_TYPES.includes(mimetype as KbAllowedUploadMimeType);
}

function bufferStartsWith(buf: Buffer, signature: ReadonlyArray<number>): boolean {
  if (buf.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buf[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

export function validateMagicBytesFromBuffer(buf: Buffer, mimetype: string): boolean {
  if (!isAllowedKbUploadMimeType(mimetype)) {
    return false;
  }
  return bufferStartsWith(buf, MAGIC_BYTES[mimetype]);
}

export async function validateMagicBytesFromPath(
  filePath: string,
  mimetype: string
): Promise<boolean> {
  if (!isAllowedKbUploadMimeType(mimetype)) {
    return false;
  }
  const sig = MAGIC_BYTES[mimetype];
  const fh = await fsPromises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(sig.length);
    const { bytesRead } = await fh.read(buf, 0, sig.length, 0);
    return bytesRead === sig.length && bufferStartsWith(buf, sig);
  } finally {
    await fh.close();
  }
}
