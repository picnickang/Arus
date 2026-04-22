/**
 * Work Order Validation & Workflow — Unit Tests
 *
 * Tests Zod schemas and workflow type mapping for work order operations.
 * Critical: invalid work orders can block maintenance execution.
 */

import { describe, it, expect } from "@jest/globals";
import {
  createTaskSchema,
  updateTaskSchema,
  isoDateString,
  cloneWorkOrderSchema,
} from "../../server/domains/work-orders/interfaces/schemas";
import { mapOutcomeToValidation } from "../../server/domains/work-orders/domain/workflow-types";

describe("Work Order Schemas", () => {
  describe("createTaskSchema", () => {
    it("accepts valid task", () => {
      const result = createTaskSchema.safeParse({
        description: "Replace main engine bearing",
        isCompleted: false,
        sortOrder: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty description", () => {
      const result = createTaskSchema.safeParse({ description: "" });
      expect(result.success).toBe(false);
    });

    it("defaults isCompleted to false", () => {
      const result = createTaskSchema.parse({ description: "Check oil level" });
      expect(result.isCompleted).toBe(false);
    });

    it("defaults sortOrder to 0", () => {
      const result = createTaskSchema.parse({ description: "Inspect valve" });
      expect(result.sortOrder).toBe(0);
    });
  });

  describe("updateTaskSchema", () => {
    it("accepts partial update", () => {
      const result = updateTaskSchema.safeParse({ isCompleted: true, completedBy: "eng-01" });
      expect(result.success).toBe(true);
    });

    it("accepts empty object (all optional)", () => {
      const result = updateTaskSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects empty description string when provided", () => {
      const result = updateTaskSchema.safeParse({ description: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("isoDateString", () => {
    it("accepts YYYY-MM-DD format", () => {
      expect(isoDateString.safeParse("2025-06-15").success).toBe(true);
    });

    it("accepts full ISO 8601 with timezone", () => {
      expect(isoDateString.safeParse("2025-06-15T14:30:00Z").success).toBe(true);
      expect(isoDateString.safeParse("2025-06-15T14:30:00+08:00").success).toBe(true);
    });

    it("accepts ISO 8601 with milliseconds", () => {
      expect(isoDateString.safeParse("2025-06-15T14:30:00.000Z").success).toBe(true);
    });

    it("rejects invalid date formats", () => {
      expect(isoDateString.safeParse("15/06/2025").success).toBe(false);
      expect(isoDateString.safeParse("June 15, 2025").success).toBe(false);
      expect(isoDateString.safeParse("not-a-date").success).toBe(false);
      expect(isoDateString.safeParse("").success).toBe(false);
    });
  });

  describe("cloneWorkOrderSchema", () => {
    it("accepts valid clone request with dates", () => {
      const result = cloneWorkOrderSchema.safeParse({
        plannedStartDate: "2025-07-01",
        plannedEndDate: "2025-07-15",
        includeTasks: true,
        includeParts: false,
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty clone request (all optional)", () => {
      expect(cloneWorkOrderSchema.safeParse({}).success).toBe(true);
    });

    it("rejects end date before start date", () => {
      const result = cloneWorkOrderSchema.safeParse({
        plannedStartDate: "2025-07-15",
        plannedEndDate: "2025-07-01",
      });
      expect(result.success).toBe(false);
    });

    it("accepts null dates", () => {
      const result = cloneWorkOrderSchema.safeParse({
        plannedStartDate: null,
        plannedEndDate: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Work Order Workflow Types", () => {
  describe("mapOutcomeToValidation", () => {
    it("maps confirmed to valid", () => {
      expect(mapOutcomeToValidation("confirmed")).toBe("valid");
    });

    it("maps partial to valid", () => {
      expect(mapOutcomeToValidation("partial")).toBe("valid");
    });

    it("maps false_alarm to disputed", () => {
      expect(mapOutcomeToValidation("false_alarm")).toBe("disputed");
    });
  });
});
