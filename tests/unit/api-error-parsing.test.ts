/**
 * E1: ApiError parses every error body shape the server has historically
 * produced, keeps the legacy "{status}: {detail}" message format, and exposes
 * typed status/code/details instead of "[object Object]".
 */

import { describe, it, expect } from "@jest/globals";
import { ApiError, apiErrorFromResponse } from "../../client/src/lib/api-error";

describe("apiErrorFromResponse (E1)", () => {
  it("parses plain-text bodies", () => {
    const err = apiErrorFromResponse(502, "Bad Gateway");
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("502: Bad Gateway");
    expect(err.code).toBeUndefined();
  });

  it("parses legacy { message } bodies", () => {
    const err = apiErrorFromResponse(404, JSON.stringify({ message: "Vessel not found" }));
    expect(err.message).toBe("404: Vessel not found");
    expect(err.status).toBe(404);
  });

  it("parses legacy { error: string } bodies", () => {
    const err = apiErrorFromResponse(400, JSON.stringify({ error: "Missing orgId" }));
    expect(err.message).toBe("400: Missing orgId");
  });

  it("parses { message, error } pairs without dropping the cause", () => {
    const err = apiErrorFromResponse(
      500,
      JSON.stringify({ message: "Failed to update equipment", error: "db timeout" })
    );
    expect(err.message).toBe("500: Failed to update equipment: db timeout");
  });

  it("parses Zod { message, errors[] } bodies into field errors", () => {
    const err = apiErrorFromResponse(
      400,
      JSON.stringify({
        message: "Validation error",
        errors: [
          { path: ["name"], message: "Required" },
          { path: ["hours"], message: "Must be positive" },
        ],
      })
    );
    expect(err.message).toBe("400: name: Required, hours: Must be positive");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(err.details)).toBe(true);
  });

  it("parses nested { error: { code, message } } bodies (no more [object Object])", () => {
    const err = apiErrorFromResponse(
      409,
      JSON.stringify({
        error: { code: "IDEMPOTENCY_KEY_REUSED", message: "Key already used" },
      })
    );
    expect(err.message).toBe("409: Key already used");
    expect(err.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("parses the canonical envelope with a correlation id", () => {
    const err = apiErrorFromResponse(
      500,
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL",
          message: "Internal server error",
          correlationId: "abc-123",
        },
        message: "Internal server error",
      })
    );
    expect(err.message).toBe("500: Internal server error");
    expect(err.code).toBe("INTERNAL");
    expect(err.correlationId).toBe("abc-123");
  });

  it("keeps the parsed body available for advanced consumers", () => {
    const body = { message: "Conflict", version: 7 };
    const err = apiErrorFromResponse(409, JSON.stringify(body));
    expect(err.body).toEqual(body);
  });

  it("status-prefix matching used around the codebase keeps working", () => {
    const err = apiErrorFromResponse(401, JSON.stringify({ message: "Unauthorized" }));
    expect(err.message.startsWith("401")).toBe(true);
  });
});
