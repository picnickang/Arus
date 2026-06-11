/**
 * Validation Tests
 * Tests crew validation, assignment checks, and vessel warnings
 */

import { describe, test, expect, getResults, resetResults, printSummary } from "./test-utils.mjs";

// Crew validation utilities
function validateCrewMember(crew) {
  const errors = [];

  if (!crew.name || crew.name.trim() === "") {
    errors.push("Name is required");
  }

  if (!crew.role || crew.role.trim() === "") {
    errors.push("Role is required");
  }

  if (crew.certifications) {
    for (const cert of crew.certifications) {
      if (cert.expiryDate && new Date(cert.expiryDate) < new Date()) {
        errors.push(`Certification "${cert.name}" has expired`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateAssignment(assignment, existingAssignments = []) {
  const errors = [];
  const warnings = [];

  if (!assignment.crewId) {
    errors.push("Crew member is required");
  }

  if (!assignment.vesselId) {
    errors.push("Vessel is required");
  }

  if (!assignment.startDate || !assignment.endDate) {
    errors.push("Start and end dates are required");
  }

  if (assignment.startDate && assignment.endDate) {
    const start = new Date(assignment.startDate);
    const end = new Date(assignment.endDate);

    if (end <= start) {
      errors.push("End date must be after start date");
    }

    // Check for overlaps
    for (const existing of existingAssignments) {
      if (existing.crewId === assignment.crewId && existing.id !== assignment.id) {
        const existStart = new Date(existing.startDate);
        const existEnd = new Date(existing.endDate);

        if (start < existEnd && end > existStart) {
          warnings.push(
            `Overlaps with existing assignment on ${existing.vesselName || "another vessel"}`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkVesselCapacity(vesselId, assignments, maxCrew = 20) {
  const activeAssignments = assignments.filter(
    (a) => a.vesselId === vesselId && new Date(a.endDate) > new Date()
  );

  return {
    current: activeAssignments.length,
    max: maxCrew,
    available: maxCrew - activeAssignments.length,
    atCapacity: activeAssignments.length >= maxCrew,
  };
}

function getCrewAvailability(crewId, assignments, dateRange) {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  const conflicting = assignments.filter((a) => {
    if (a.crewId !== crewId) return false;
    const aStart = new Date(a.startDate);
    const aEnd = new Date(a.endDate);
    return start < aEnd && end > aStart;
  });

  return {
    available: conflicting.length === 0,
    conflicts: conflicting.map((a) => ({
      vesselName: a.vesselName,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
  };
}

console.log("\n🧪 Running Validation Tests\n");
resetResults();

describe("Crew Member Validation", () => {
  test("accepts valid crew member", () => {
    const crew = { name: "John Smith", role: "Captain" };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing name", () => {
    const crew = { name: "", role: "Captain" };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Name is required");
  });

  test("rejects missing role", () => {
    const crew = { name: "John Smith", role: "" };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Role is required");
  });

  test("rejects whitespace-only name", () => {
    const crew = { name: "   ", role: "Captain" };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(false);
  });

  test("detects expired certifications", () => {
    const crew = {
      name: "John Smith",
      role: "Captain",
      certifications: [{ name: "STCW", expiryDate: "2020-01-01" }],
    };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("STCW");
    expect(result.errors[0]).toContain("expired");
  });

  test("accepts valid certifications", () => {
    const crew = {
      name: "John Smith",
      role: "Captain",
      certifications: [{ name: "STCW", expiryDate: "2030-01-01" }],
    };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(true);
  });

  test("handles missing certifications array", () => {
    const crew = { name: "John Smith", role: "Deckhand" };
    const result = validateCrewMember(crew);

    expect(result.valid).toBe(true);
  });
});

describe("Assignment Validation", () => {
  test("accepts valid assignment", () => {
    const assignment = {
      crewId: "1",
      vesselId: "v1",
      startDate: "2025-01-01",
      endDate: "2025-01-15",
    };
    const result = validateAssignment(assignment);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing crew ID", () => {
    const assignment = {
      vesselId: "v1",
      startDate: "2025-01-01",
      endDate: "2025-01-15",
    };
    const result = validateAssignment(assignment);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Crew member is required");
  });

  test("rejects missing vessel ID", () => {
    const assignment = {
      crewId: "1",
      startDate: "2025-01-01",
      endDate: "2025-01-15",
    };
    const result = validateAssignment(assignment);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Vessel is required");
  });

  test("rejects end date before start date", () => {
    const assignment = {
      crewId: "1",
      vesselId: "v1",
      startDate: "2025-01-15",
      endDate: "2025-01-01",
    };
    const result = validateAssignment(assignment);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("End date must be after start date");
  });

  test("rejects same start and end date", () => {
    const assignment = {
      crewId: "1",
      vesselId: "v1",
      startDate: "2025-01-15",
      endDate: "2025-01-15",
    };
    const result = validateAssignment(assignment);

    expect(result.valid).toBe(false);
  });

  test("detects overlapping assignments", () => {
    const existing = [
      {
        id: "a1",
        crewId: "1",
        vesselId: "v1",
        vesselName: "MV Pacific",
        startDate: "2025-01-10",
        endDate: "2025-01-20",
      },
    ];

    const assignment = {
      id: "a2",
      crewId: "1",
      vesselId: "v2",
      startDate: "2025-01-15",
      endDate: "2025-01-25",
    };

    const result = validateAssignment(assignment, existing);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Overlaps");
    expect(result.warnings[0]).toContain("MV Pacific");
  });

  test("allows non-overlapping assignments", () => {
    const existing = [
      {
        id: "a1",
        crewId: "1",
        vesselId: "v1",
        startDate: "2025-01-01",
        endDate: "2025-01-10",
      },
    ];

    const assignment = {
      id: "a2",
      crewId: "1",
      vesselId: "v2",
      startDate: "2025-01-15",
      endDate: "2025-01-25",
    };

    const result = validateAssignment(assignment, existing);

    expect(result.warnings).toHaveLength(0);
  });

  test("ignores self when checking overlaps", () => {
    const existing = [
      {
        id: "a1",
        crewId: "1",
        vesselId: "v1",
        startDate: "2025-01-10",
        endDate: "2025-01-20",
      },
    ];

    const assignment = {
      id: "a1", // Same ID - editing existing
      crewId: "1",
      vesselId: "v1",
      startDate: "2025-01-12",
      endDate: "2025-01-22",
    };

    const result = validateAssignment(assignment, existing);

    expect(result.warnings).toHaveLength(0);
  });
});

describe("Vessel Capacity", () => {
  test("calculates available capacity", () => {
    const assignments = [
      { vesselId: "v1", endDate: "2030-01-01" },
      { vesselId: "v1", endDate: "2030-01-01" },
      { vesselId: "v2", endDate: "2030-01-01" },
    ];

    const result = checkVesselCapacity("v1", assignments, 10);

    expect(result.current).toBe(2);
    expect(result.max).toBe(10);
    expect(result.available).toBe(8);
    expect(result.atCapacity).toBe(false);
  });

  test("detects at-capacity vessel", () => {
    const assignments = Array.from({ length: 20 }, () => ({
      vesselId: "v1",
      endDate: "2030-01-01",
    }));

    const result = checkVesselCapacity("v1", assignments, 20);

    expect(result.atCapacity).toBe(true);
    expect(result.available).toBe(0);
  });

  test("excludes expired assignments", () => {
    const assignments = [
      { vesselId: "v1", endDate: "2020-01-01" }, // expired
      { vesselId: "v1", endDate: "2030-01-01" }, // active
    ];

    const result = checkVesselCapacity("v1", assignments, 10);

    expect(result.current).toBe(1);
  });
});

describe("Crew Availability", () => {
  test("detects available crew", () => {
    const assignments = [
      {
        crewId: "1",
        vesselName: "MV Pacific",
        startDate: "2025-01-01",
        endDate: "2025-01-10",
      },
    ];

    const result = getCrewAvailability("1", assignments, {
      start: "2025-01-15",
      end: "2025-01-25",
    });

    expect(result.available).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  test("detects conflicts", () => {
    const assignments = [
      {
        crewId: "1",
        vesselName: "MV Pacific",
        startDate: "2025-01-10",
        endDate: "2025-01-20",
      },
    ];

    const result = getCrewAvailability("1", assignments, {
      start: "2025-01-15",
      end: "2025-01-25",
    });

    expect(result.available).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].vesselName).toBe("MV Pacific");
  });

  test("ignores other crew members", () => {
    const assignments = [
      {
        crewId: "2", // Different crew
        vesselName: "MV Pacific",
        startDate: "2025-01-10",
        endDate: "2025-01-20",
      },
    ];

    const result = getCrewAvailability("1", assignments, {
      start: "2025-01-15",
      end: "2025-01-25",
    });

    expect(result.available).toBe(true);
  });
});

const results = getResults();
printSummary();

export { results };
