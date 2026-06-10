/**
 * Typed client-side API error.
 *
 * One parser handles every error body shape the server has historically
 * produced — `{message}`, `{error: string}`, Zod `{message, errors[]}`,
 * nested `{error: {code, message}}` — plus the canonical envelope
 * (`{success: false, error: {...}, message}`), so consumers stop seeing
 * "[object Object]" and can branch on `status`/`code` instead of sniffing
 * message strings.
 *
 * `message` keeps the legacy `"{status}: {detail}"` format because existing
 * code matches on prefixes like `error.message.startsWith("401")`.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  readonly correlationId: string | undefined;
  /** Parsed response body when the server sent JSON, otherwise undefined. */
  readonly body: unknown;

  constructor(init: {
    status: number;
    detail: string;
    code?: string | undefined;
    details?: unknown;
    correlationId?: string | undefined;
    body?: unknown;
  }) {
    super(`${init.status}: ${init.detail}`);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.correlationId = init.correlationId;
    this.body = init.body;
  }
}

interface ParsedErrorBody {
  detail: string;
  code?: string | undefined;
  details?: unknown;
  correlationId?: string | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function joinFieldErrors(
  errors: { path?: string[] | undefined; message: string }[]
): string {
  return errors
    .map((err) => `${err.path?.join(".") || "Field"}: ${err.message}`)
    .join(", ");
}

function parseErrorBody(body: unknown, fallbackText: string): ParsedErrorBody {
  const record = asRecord(body);
  if (!record) {
    return { detail: fallbackText };
  }

  const topMessage = typeof record["message"] === "string" ? record["message"] : undefined;
  const correlationId =
    typeof record["correlationId"] === "string" ? record["correlationId"] : undefined;

  // Nested error object: idempotency middleware, canonical envelope.
  const nested = asRecord(record["error"]);
  if (nested && typeof nested["message"] === "string") {
    return {
      detail: nested["message"],
      code: typeof nested["code"] === "string" ? nested["code"] : undefined,
      details: nested["details"],
      correlationId:
        typeof nested["correlationId"] === "string"
          ? nested["correlationId"]
          : correlationId,
    };
  }

  // Zod validation shape: { message, errors: [{ path, message }] }.
  const errors = record["errors"];
  if (Array.isArray(errors) && errors.length > 0) {
    const fieldErrors = joinFieldErrors(
      errors as { path?: string[]; message: string }[]
    );
    return {
      detail: fieldErrors || topMessage || fallbackText,
      code: "VALIDATION_ERROR",
      details: errors,
      correlationId,
    };
  }

  // sendValidationError shape: { message, errors: fieldErrorMap, issues: [...] }.
  const issues = record["issues"];
  if (Array.isArray(issues) && issues.length > 0) {
    const fieldErrors = joinFieldErrors(
      issues as { path?: string[]; message: string }[]
    );
    return {
      detail: fieldErrors || topMessage || fallbackText,
      code: "VALIDATION_ERROR",
      details: issues,
      correlationId,
    };
  }

  if (topMessage) {
    // Legacy { message, error } pairs carry the specific cause in `error`.
    const errorText = typeof record["error"] === "string" ? record["error"] : undefined;
    return {
      detail: errorText && errorText !== topMessage ? `${topMessage}: ${errorText}` : topMessage,
      code: typeof record["code"] === "string" ? record["code"] : undefined,
      details: record["details"],
      correlationId,
    };
  }

  if (typeof record["error"] === "string") {
    return { detail: record["error"], correlationId };
  }

  return { detail: fallbackText };
}

/**
 * Builds an ApiError from a non-OK response's status and raw text body.
 * `parsedBody` may be passed when the caller already JSON.parsed the text.
 */
export function apiErrorFromResponse(
  status: number,
  text: string,
  parsedBody?: unknown
): ApiError {
  let body = parsedBody;
  if (body === undefined && text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  const parsed = parseErrorBody(body, text);
  return new ApiError({
    status,
    detail: parsed.detail,
    code: parsed.code,
    details: parsed.details,
    correlationId: parsed.correlationId,
    body,
  });
}
