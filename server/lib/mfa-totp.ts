/**
 * Wave 1.2 — Time-based One-Time Password (TOTP) MFA.
 *
 * Thin wrapper over the `otpauth` library. Exposed as four small,
 * dependency-light helpers so route layers and the session-management
 * surface can verify a 6-digit code without learning about RFC 6238
 * window arithmetic or base32 alphabets.
 *
 * Session-management already carries `mfaVerified` / `mfaVerifiedAt`
 * on `userSessions`, so this module owns enrollment + verification
 * only; session re-stamping is the caller's responsibility.
 *
 * Default issuer is "ARUS"; can be overridden via MFA_TOTP_ISSUER.
 * Default skew window is ±1 step (±30s) to tolerate clock drift.
 */
import { TOTP, Secret } from "otpauth";
import { randomInt } from "node:crypto";

const DEFAULT_ISSUER = process.env["MFA_TOTP_ISSUER"] || "ARUS";
const DEFAULT_WINDOW = 1;
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;

export interface TotpEnrollment {
  /** Base32-encoded secret to store (encrypted at rest by the caller). */
  secretBase32: string;
  /** otpauth:// URI for QR generation in the enrolment UI. */
  otpauthUri: string;
}

export function generateTotpEnrollment(label: string): TotpEnrollment {
  const secret = new Secret({ size: 20 }); // 160-bit per RFC 4226 §4
  const totp = new TOTP({
    issuer: DEFAULT_ISSUER,
    label,
    algorithm: "SHA1",
    digits: DEFAULT_DIGITS,
    period: DEFAULT_PERIOD,
    secret,
  });
  return { secretBase32: secret.base32, otpauthUri: totp.toString() };
}

export function verifyTotpCode(secretBase32: string, code: string): boolean {
  // `validate` returns the delta in periods (negative/positive) or null
  // if no match within the window. We accept any match within ±1 step.
  if (!secretBase32 || !code) {
    return false;
  }
  try {
    const totp = new TOTP({
      issuer: DEFAULT_ISSUER,
      algorithm: "SHA1",
      digits: DEFAULT_DIGITS,
      period: DEFAULT_PERIOD,
      secret: Secret.fromBase32(secretBase32),
    });
    const delta = totp.validate({ token: code.replace(/\s+/g, ""), window: DEFAULT_WINDOW });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * Generate N single-use recovery codes for break-glass scenarios when
 * the authenticator app is lost. Caller MUST hash each before storage
 * (treat as passwords — they're as powerful as the TOTP secret).
 */
export function generateRecoveryCodes(count = 10): string[] {
  const out: string[] = [];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Crockford-ish, no 0/O/1/I
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let c = 0; c < 10; c++) {
      // SEC: recovery codes are break-glass credentials "as powerful as
      // the TOTP secret" — they MUST use a CSPRNG. `crypto.randomInt`
      // gives a uniform, unbiased index (rejection-sampled internally),
      // replacing the predictable `Math.random()`.
      code += alphabet[randomInt(alphabet.length)];
      if (c === 4) {
        code += "-";
      }
    }
    out.push(code);
  }
  return out;
}
