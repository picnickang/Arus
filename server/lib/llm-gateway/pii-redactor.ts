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

function sumHits(hits: RedactionResult["hits"]): number {
  return hits.emails + hits.phones + hits.longDigits + hits.ssns;
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    "text" in part &&
    part.type === "text" &&
    typeof part.text === "string"
  );
}

/**
 * Redact one message's content. Handles both plain strings and multipart
 * arrays (e.g. `[{type:"text", text}, {type:"image_url", …}]`): text parts are
 * redacted, non-text parts (images, etc.) are left untouched. Returns the same
 * reference when nothing changed so the caller can skip a needless copy.
 */
function redactContent(content: unknown): { content: unknown; hits: number } {
  if (typeof content === "string") {
    const { redacted, hits } = redactPII(content);
    return { content: redacted, hits: sumHits(hits) };
  }
  if (Array.isArray(content)) {
    let hits = 0;
    let changed = false;
    const parts = content.map((part) => {
      if (!isTextPart(part)) {
        return part;
      }
      const { redacted, hits: partHits } = redactPII(part.text);
      hits += sumHits(partHits);
      if (redacted !== part.text) {
        changed = true;
      }
      return { ...part, text: redacted };
    });
    return { content: changed ? parts : content, hits };
  }
  return { content, hits: 0 };
}

/**
 * Redact PII inside an assistant message's tool calls. Only the model-emitted
 * `function.arguments` JSON string is scrubbed; `function.name` and the tool
 * call `id` are routing/correlation identifiers and are left intact so the
 * provider can still dispatch and correlate the call. Returns the same
 * reference when nothing changed.
 */
function redactToolCalls(toolCalls: unknown): { toolCalls: unknown; hits: number; changed: boolean } {
  if (!Array.isArray(toolCalls)) {
    return { toolCalls, hits: 0, changed: false };
  }
  let hits = 0;
  let changed = false;
  const out = toolCalls.map((tc) => {
    const fn = (tc as { function?: { arguments?: unknown } })?.function;
    if (!fn || typeof fn.arguments !== "string") {
      return tc;
    }
    const { redacted, hits: argHits } = redactPII(fn.arguments);
    hits += sumHits(argHits);
    if (redacted === fn.arguments) {
      return tc;
    }
    changed = true;
    return { ...(tc as object), function: { ...fn, arguments: redacted } };
  });
  return { toolCalls: changed ? out : toolCalls, hits, changed };
}

export function redactMessages<T extends { role: string; content: unknown }>(
  messages: readonly T[]
): { messages: T[]; totalHits: number } {
  let totalHits = 0;
  const out = messages.map((m) => {
    const next = redactContent(m.content);
    const tc = redactToolCalls((m as { toolCalls?: unknown }).toolCalls);
    totalHits += next.hits + tc.hits;
    if (next.content === m.content && !tc.changed) {
      return m;
    }
    return {
      ...m,
      content: next.content,
      ...(tc.changed ? { toolCalls: tc.toolCalls } : {}),
    } as T;
  });
  return { messages: out, totalHits };
}
