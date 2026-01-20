/**
 * API Helpers Unit Tests
 * 
 * Tests the utility functions in server/lib/api-helpers.ts
 * These don't require database connectivity
 */

import { describe, it, expect, jest } from "@jest/globals";
import {
  parsePagination,
  parsePaginationWithDefaults,
  paginatedResponse,
  parseIntParam,
  parseUUID,
  parseDateRange,
} from "../../server/lib/api-helpers.js";

describe("API Helpers", () => {
  describe("parsePagination", () => {
    it("should parse valid pagination params", () => {
      const result = parsePagination({ page: "2", limit: "20" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.params.page).toBe(2);
        expect(result.params.limit).toBe(20);
        expect(result.params.offset).toBe(20);
      }
    });

    it("should use default values when params are missing", () => {
      const result = parsePagination({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.params.page).toBe(1);
        expect(result.params.limit).toBe(50);
        expect(result.params.offset).toBe(0);
      }
    });

    it("should handle string numbers", () => {
      const result = parsePagination({ page: "5", limit: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.params.page).toBe(5);
        expect(result.params.limit).toBe(100);
      }
    });

    it("should reject invalid page values", () => {
      const result = parsePagination({ page: "0", limit: "10" });
      expect(result.success).toBe(false);
    });

    it("should reject limit exceeding max", () => {
      const result = parsePagination({ page: "1", limit: "1000" });
      expect(result.success).toBe(false);
    });
  });

  describe("parsePaginationWithDefaults", () => {
    it("should return defaults for invalid input", () => {
      const result = parsePaginationWithDefaults({ page: "invalid" });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("should accept custom defaults", () => {
      const result = parsePaginationWithDefaults(
        { page: "invalid" },
        { page: 3, limit: 25, offset: 50 }
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it("should use provided values over defaults", () => {
      const result = parsePaginationWithDefaults(
        { page: "2", limit: "30" },
        { page: 1, limit: 10 }
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(30);
    });
  });

  describe("paginatedResponse", () => {
    it("should format paginated response correctly", () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 10, offset: 0 };
      
      const result = paginatedResponse(data, pagination, 50);
      
      expect(result.data).toEqual(data);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should calculate hasMore without total", () => {
      const data = Array(10).fill({ id: 1 });
      const pagination = { page: 1, limit: 10, offset: 0 };
      
      const result = paginatedResponse(data, pagination);
      
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should set hasMore false when data length is less than limit", () => {
      const data = [{ id: 1 }];
      const pagination = { page: 1, limit: 10, offset: 0 };
      
      const result = paginatedResponse(data, pagination);
      
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe("parseIntParam", () => {
    it("should parse string numbers", () => {
      expect(parseIntParam("42", 0)).toBe(42);
    });

    it("should return default for invalid strings", () => {
      expect(parseIntParam("invalid", 10)).toBe(10);
    });

    it("should return default for negative numbers", () => {
      expect(parseIntParam("-5", 0)).toBe(0);
    });

    it("should respect max value", () => {
      expect(parseIntParam("100", 0, 50)).toBe(50);
    });

    it("should handle number input", () => {
      expect(parseIntParam(25, 0)).toBe(25);
    });

    it("should floor decimal numbers", () => {
      expect(parseIntParam(25.7, 0)).toBe(25);
    });
  });

  describe("parseUUID", () => {
    it("should accept valid UUIDs", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(parseUUID(uuid)).toBe(uuid);
    });

    it("should reject invalid UUIDs", () => {
      expect(parseUUID("not-a-uuid")).toBeNull();
      expect(parseUUID("550e8400-e29b-41d4-a716")).toBeNull();
      expect(parseUUID(12345)).toBeNull();
      expect(parseUUID(null)).toBeNull();
    });

    it("should accept uppercase UUIDs", () => {
      const uuid = "550E8400-E29B-41D4-A716-446655440000";
      expect(parseUUID(uuid)).toBe(uuid);
    });
  });

  describe("parseDateRange", () => {
    it("should extract date strings from query", () => {
      const result = parseDateRange({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-12-31");
    });

    it("should handle missing dates", () => {
      const result = parseDateRange({});
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it("should ignore non-string values", () => {
      const result = parseDateRange({
        startDate: 12345,
        endDate: { date: "2024-01-01" },
      });
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });
  });
});
