/**
 * E3/E4: handleApiError maps typed domain errors by instanceof (regex
 * inference stays as a deprecated fallback), and production 5xx bodies are
 * redacted to a generic message + correlation id.
 */

import { describe, it, expect, afterEach, jest } from "@jest/globals";
import { z } from "zod";
import type { Response } from "express";
import { handleApiError } from "../../server/lib/route-utils";
import { sendServerError } from "../../server/lib/api-helpers";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../server/lib/domain-errors";

function buildRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

const ORIGINAL_NODE_ENV = process.env["NODE_ENV"];
afterEach(() => {
  process.env["NODE_ENV"] = ORIGINAL_NODE_ENV;
});

describe("handleApiError (E3)", () => {
  it("maps typed domain errors by instanceof with their code", () => {
    const cases = [
      { error: new NotFoundError("Pump not found"), status: 404, code: "NOT_FOUND" },
      { error: new ConflictError("Version conflict"), status: 409, code: "CONFLICT" },
      { error: new ForbiddenError(), status: 403, code: "FORBIDDEN" },
      { error: new ValidationError("Bad input"), status: 400, code: "VALIDATION_ERROR" },
      { error: new PreconditionFailedError(), status: 412, code: "PRECONDITION_FAILED" },
    ];
    for (const { error, status, code } of cases) {
      const res = buildRes();
      handleApiError(res, error, "test operation");
      expect(res.statusCode).toBe(status);
      expect(res.body["code"]).toBe(code);
      expect(res.body["error"]).toBe(error.message);
    }
  });

  it("includes details when the domain error carries them", () => {
    const res = buildRes();
    handleApiError(res, new ConflictError("stale", { serverVersion: 4 }), "update work order");
    expect(res.body["details"]).toEqual({ serverVersion: 4 });
  });

  it("still maps ZodError to 400 with issues", () => {
    const res = buildRes();
    const zodError = z.object({ name: z.string() }).safeParse({}).error as z.ZodError;
    handleApiError(res, zodError, "validate input");
    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.body["errors"])).toBe(true);
  });

  it("keeps the deprecated regex inference for unmigrated throw sites", () => {
    const res = buildRes();
    handleApiError(res, new Error("Equipment not found"), "fetch equipment");
    expect(res.statusCode).toBe(404);
  });

  it("redacts 500 bodies in production and exposes them in dev", () => {
    process.env["NODE_ENV"] = "production";
    const prodRes = buildRes();
    handleApiError(prodRes, new Error("connect ECONNREFUSED 10.0.0.5:5432"), "load data");
    expect(prodRes.statusCode).toBe(500);
    expect(prodRes.body["error"]).toBe("Internal server error");
    expect(JSON.stringify(prodRes.body)).not.toContain("ECONNREFUSED");

    process.env["NODE_ENV"] = "development";
    const devRes = buildRes();
    handleApiError(devRes, new Error("connect ECONNREFUSED 10.0.0.5:5432"), "load data");
    expect(devRes.body["error"]).toContain("ECONNREFUSED");
  });

  it("4xx messages stay intact in production (only 5xx redacts)", () => {
    process.env["NODE_ENV"] = "production";
    const res = buildRes();
    handleApiError(res, new NotFoundError("Pump not found"), "fetch pump");
    expect(res.statusCode).toBe(404);
    expect(res.body["error"]).toBe("Pump not found");
  });
});

describe("sendServerError (E4)", () => {
  it("redacts internal messages in production", () => {
    process.env["NODE_ENV"] = "production";
    const res = buildRes();
    sendServerError(res, new Error('relation "secret_table" does not exist'), "query data");
    expect(res.body["error"]).toBe("Internal server error");
    expect(JSON.stringify(res.body)).not.toContain("secret_table");
  });

  it("keeps the real message outside production", () => {
    process.env["NODE_ENV"] = "test";
    const res = buildRes();
    sendServerError(res, new Error("boom"), "query data");
    expect(res.body["error"]).toBe("boom");
  });
});
