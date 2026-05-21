/**
 * Input Sanitization - Prevent injection attacks
 */

export function sanitizeInput(input: string, skipLengthLimit = false): string {
  if (typeof input !== "string") {
    return input;
  }

  let sanitized = input.replace(/\0/g, "");
  sanitized = sanitized.trim();

  if (!skipLengthLimit) {
    const maxLength = 10000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
  }

  return sanitized;
}

export function validateDatabaseIdentifier(identifier: string): boolean {
  const pattern = /^[a-zA-Z0-9_-]+$/;
  return pattern.test(identifier) && identifier.length <= 100;
}

export function sanitizeForHTML(input: string): string {
  if (typeof input !== "string") {
    return input;
  }

  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function sanitizeMongoQuery(query: unknown): unknown {
  if (typeof query !== "object" || query === null) {
    return query;
  }

  const sanitized: Record<string, unknown> | unknown[] = Array.isArray(query) ? [] : {};

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (key.startsWith("$")) {
      continue;
    }

    let nextValue: unknown;
    if (typeof value === "object" && value !== null) {
      nextValue = sanitizeMongoQuery(value);
    } else if (typeof value === "string") {
      nextValue = sanitizeInput(value);
    } else {
      nextValue = value;
    }

    if (Array.isArray(sanitized)) {
      sanitized.push(nextValue);
    } else {
      sanitized[key] = nextValue;
    }
  }

  return sanitized;
}

export function sanitizeRequestBody(obj: unknown, skipLengthLimit = false): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeRequestBody(item, skipLengthLimit));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeInput(value, skipLengthLimit);
      } else if (typeof value === "object") {
        sanitized[key] = sanitizeRequestBody(value, skipLengthLimit);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  if (typeof obj === "string") {
    return sanitizeInput(obj, skipLengthLimit);
  }

  return obj;
}
