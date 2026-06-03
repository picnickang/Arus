/**
 * Image magic-byte validation shared by upload routes.
 *
 * Multer's `fileFilter` only inspects the client-supplied `Content-Type`,
 * which is trivially spoofable. Re-verify the leading bytes of the payload
 * before persisting it to object storage.
 */

export const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const IMAGE_MAGIC_BYTES: Record<AllowedImageMimeType, ReadonlyArray<number>> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

export function isAllowedImageMimeType(mimetype: string): mimetype is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as ReadonlyArray<string>).includes(mimetype);
}

function bufferStartsWith(buf: Buffer, signature: ReadonlyArray<number>): boolean {
  if (buf.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i += 1) {
    if (buf[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Returns true only when `mimetype` is an allowed image type AND the
 * buffer's leading bytes match that type's signature.
 */
export function validateImageMagicBytes(buf: Buffer, mimetype: string): boolean {
  if (!isAllowedImageMimeType(mimetype)) {
    return false;
  }
  return bufferStartsWith(buf, IMAGE_MAGIC_BYTES[mimetype]);
}
