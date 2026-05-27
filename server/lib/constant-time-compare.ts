/**
 * LR-3.5 / SEC-2 — constant-time string comparison.
 *
 * Hashes both inputs to a fixed-size sha256 digest first, then compares
 * the digests with `crypto.timingSafeEqual`. This protects against two
 * leaks at once:
 *   (a) timing leak from `===` short-circuiting on the first differing
 *       byte (which gives a network-timing attacker a viable channel
 *       even with per-IP rate limiting);
 *   (b) length leak — `timingSafeEqual` throws on unequal-length
 *       buffers, which itself reveals candidate length; pre-hashing
 *       normalises both sides to 32 bytes.
 *
 * Exported as a free function so it can be unit-tested without pulling
 * in the auth-routes module (which transitively imports DB code with
 * top-level `await`).
 */
import crypto from "crypto";

export function constantTimeEqualString(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}
