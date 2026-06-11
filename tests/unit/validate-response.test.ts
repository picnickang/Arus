import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { z } from "zod";
import { validateResponse } from "../../server/lib/api-helpers.js";

describe("validateResponse", () => {
  const userSchema = z
    .object({
      id: z.string().or(z.number()),
      name: z.string(),
      email: z.string().email().optional(),
    })
    .passthrough();

  const listSchema = z.array(userSchema);

  describe("happy path", () => {
    it("returns parsed payload when shape matches", () => {
      const payload = { id: "u1", name: "Alice" };
      const result = validateResponse(userSchema, payload, "GET /api/users/:id");
      expect(result).toEqual(payload);
    });

    it("supports passthrough so extra fields survive", () => {
      const payload = { id: 1, name: "Bob", extra: "kept" };
      const result = validateResponse(userSchema, payload, "GET /api/users/:id");
      expect((result as Record<string, unknown>)["extra"]).toBe("kept");
    });

    it("accepts string-or-number id (drift-tolerant)", () => {
      const numeric = validateResponse(userSchema, { id: 42, name: "N" }, "ctx");
      const stringy = validateResponse(userSchema, { id: "42", name: "S" }, "ctx");
      expect(numeric.id).toBe(42);
      expect(stringy.id).toBe("42");
    });

    it("validates arrays via array schema", () => {
      const items = [
        { id: "1", name: "A" },
        { id: 2, name: "B" },
      ];
      const result = validateResponse(listSchema, items, "GET /api/users");
      expect(result).toHaveLength(2);
    });

    it("treats optional fields as truly optional", () => {
      const payload = { id: "u1", name: "Alice" };
      expect(() => validateResponse(userSchema, payload, "ctx")).not.toThrow();
    });
  });

  describe("non-production behavior", () => {
    const ORIGINAL = process.env["NODE_ENV"];

    beforeEach(() => {
      process.env["NODE_ENV"] = "test";
    });

    afterEach(() => {
      process.env["NODE_ENV"] = ORIGINAL;
    });

    it("throws when required field is missing", () => {
      const bad = { id: "u1" };
      expect(() => validateResponse(userSchema, bad, "GET /api/users/:id")).toThrow(
        /Response contract violation in GET \/api\/users\/:id/
      );
    });

    it("throws and includes the offending field path", () => {
      const bad = { id: "u1", name: 123 };
      expect(() => validateResponse(userSchema, bad, "ctx")).toThrow(/name:/);
    });

    it("throws when an array element violates the schema", () => {
      const bad = [{ id: "1", name: "A" }, { id: "2" }];
      expect(() => validateResponse(listSchema, bad, "GET /api/users")).toThrow(
        /Response contract violation/
      );
    });

    it("does NOT throw on email format violation when email is omitted", () => {
      expect(() =>
        validateResponse(userSchema, { id: "u1", name: "x" }, "ctx")
      ).not.toThrow();
    });

    it("throws on email format violation when email is provided badly", () => {
      expect(() =>
        validateResponse(userSchema, { id: "u1", name: "x", email: "not-an-email" }, "ctx")
      ).toThrow(/email/);
    });
  });

  describe("production behavior (logs + passes through)", () => {
    const ORIGINAL = process.env["NODE_ENV"];
    let errSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      process.env["NODE_ENV"] = "production";
      errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      process.env["NODE_ENV"] = ORIGINAL;
      errSpy.mockRestore();
    });

    it("does not throw and returns the original payload on drift", () => {
      const bad = { id: "u1" } as unknown;
      const result = validateResponse(userSchema, bad, "GET /api/users/:id");
      expect(result).toBe(bad);
      expect(errSpy).toHaveBeenCalledTimes(1);
      const message = String(errSpy.mock.calls[0][0]);
      expect(message).toMatch(/Response contract violation in GET \/api\/users\/:id/);
      expect(message).toMatch(/name:/);
    });

    it("still returns parsed payload when shape is valid", () => {
      const payload = { id: "u1", name: "Alice" };
      const result = validateResponse(userSchema, payload, "ctx");
      expect(result).toEqual(payload);
      expect(errSpy).not.toHaveBeenCalled();
    });
  });

  describe("context propagation", () => {
    it("error message embeds the provided context string", () => {
      const ORIGINAL = process.env["NODE_ENV"];
      process.env["NODE_ENV"] = "test";
      try {
        expect(() =>
          validateResponse(userSchema, { id: "u1" }, "GET /api/permissions/me")
        ).toThrow(/GET \/api\/permissions\/me/);
      } finally {
        process.env["NODE_ENV"] = ORIGINAL;
      }
    });
  });
});
