/**
 * Logging Redaction Utilities
 * Prevents sensitive data leaks in logs
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "apikey",
  "api_key",
  "secret",
  "authorization",
  "hmac",
  "access_token",
  "refresh_token",
  "session_secret",
  "admin_token",
  "vite_admin_token",
  "openai_api_key",
  "database_url",
  "neon_database_url",
]);

function redactValue(v: unknown): string {
  if (typeof v === "string") {
    if (v.length <= 4) {
      return "•redacted•";
    }
    return `${v.slice(0, 2)}…•redacted•`;
  }
  return "•redacted•";
}

export function deepRedact(obj: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[depth-capped]";
  }
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map((v) => deepRedact(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = redactValue(v);
    } else {
      out[k] = deepRedact(v, depth + 1);
    }
  }
  return out;
}

export function safeStringify(obj: unknown, maxLen = 2000): string {
  try {
    const red = deepRedact(obj);
    let s = JSON.stringify(red);
    if (s.length > maxLen) {
      s = `${s.slice(0, maxLen - 1)}…`;
    }
    return s;
  } catch {
    return "[unserializable]";
  }
}
