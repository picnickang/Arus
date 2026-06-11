/**
 * P2 #2 — Pure verifier for the X-Setup-Token header, extracted into
 * its own module so unit tests can import it without dragging in the
 * full express router, DB bootstrap, and side-effecting imports of
 * `server/routes/setup.ts`.
 *
 * Approach: constant-time digest comparison on normalised string
 * inputs. Both sides are SHA-256-hashed into fixed 32-byte buffers
 * before `timingSafeEqual`, so neither byte content nor length leaks
 * once we've reached the compare. The cheap early returns for
 * missing/empty/non-string inputs are intentional and not secret-
 * dependent (they only depend on whether config/input were supplied
 * at all), which is the standard scope for token-verification CT.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export function verifySetupToken(configuredToken: string | undefined, provided: unknown): boolean {
  if (!configuredToken || configuredToken.length === 0) {
    return false;
  }
  if (typeof provided !== "string" || provided.length === 0) {
    return false;
  }
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(configuredToken).digest();
  return timingSafeEqual(a, b);
}
