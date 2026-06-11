/**
 * Wave 3.6 — PII redaction for outbound LLM prompts and inbound logs.
 *
 * Runs as a pre-flight pass over every `LLMChatParams.messages` content
 * string before the provider call. Strips:
 *   - email addresses,
 *   - international/national phone numbers (loose),
 *   - long digit sequences likely to be passport/IMO/account numbers
 *     (12+ digits — short ones like equipment serials are left alone),
 *   - SSN-style XXX-XX-XXXX patterns.
 *
 * Crew names cannot be stripped via regex without a dictionary; that's a
 * follow-up task. Today we cover the high-volume PII classes the gap
 * doc called out (emails, phones, identifiers) and expose a per-tenant
 * toggle so privacy-sensitive tenants can disable LLM calls entirely
 * if redaction is not enough.
 *
 * Idempotent — redacting an already-redacted string is a no-op.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s\-.()]*)?(?:\(?\d{2,4}\)?[\s\-.()]*){2,4}\d{2,4}/g;
const LONG_DIGITS_RE = /\b\d{12,}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

export interface RedactionResult {
  redacted: string;
  hits: {
    emails: number;
    phones: number;
    longDigits: number;
    ssns: number;
  };
}

export function redactPII(input: string): RedactionResult {
  if (!input) {
    return { redacted: input, hits: { emails: 0, phones: 0, longDigits: 0, ssns: 0 } };
  }

  let emails = 0;
  let phones = 0;
  let longDigits = 0;
  let ssns = 0;

  let out = input.replace(EMAIL_RE, () => {
    emails++;
    return "[REDACTED_EMAIL]";
  });
  out = out.replace(SSN_RE, () => {
    ssns++;
    return "[REDACTED_SSN]";
  });
  out = out.replace(LONG_DIGITS_RE, () => {
    longDigits++;
    return "[REDACTED_ID]";
  });
  out = out.replace(PHONE_RE, (match) => {
    const digitCount = (match.match(/\d/g) || []).length;
    if (digitCount < 7 || digitCount > 15) {
      return match;
    }
    phones++;
    return "[REDACTED_PHONE]";
  });

  return { redacted: out, hits: { emails, phones, longDigits, ssns } };
}

export interface RedactedMessage {
  role: string;
  content: string | unknown;
}

export function redactMessages<T extends { role: string; content: unknown }>(
  messages: readonly T[]
): { messages: T[]; totalHits: number } {
  let totalHits = 0;
  const out = messages.map((m) => {
    if (typeof m.content !== "string") {
      return m;
    }
    const { redacted, hits } = redactPII(m.content);
    totalHits += hits.emails + hits.phones + hits.longDigits + hits.ssns;
    return { ...m, content: redacted } as T;
  });
  return { messages: out, totalHits };
}
