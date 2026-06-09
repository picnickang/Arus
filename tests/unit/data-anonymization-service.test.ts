import { DataAnonymizationService } from "../../server/compliance/data-anonymization/service";
import type { AnonymizationConfig } from "../../server/compliance/data-anonymization/types";

describe("DataAnonymizationService", () => {
  const baseConfig: AnonymizationConfig = {
    level: "full",
    preserveIds: true,
    preserveTimestamps: true,
    preserveTechnicalData: true,
    salt: "fixed-salt",
  };

  it("leaves records untouched when anonymization is disabled", () => {
    const service = new DataAnonymizationService("fixed-salt");
    const record = { id: "crew-1", name: "Jane Smith", email: "jane@example.com" };

    const result = service.anonymizeRecord(record, "crew", {
      ...baseConfig,
      level: "none",
    });

    expect(result.record).toBe(record);
    expect(result.result).toEqual({
      originalFieldCount: 3,
      anonymizedFieldCount: 0,
      skippedFieldCount: 0,
    });
  });

  it("partially anonymizes crew contact and identifier fields while preserving operational fields", () => {
    const service = new DataAnonymizationService("fixed-salt");
    const record = {
      id: "crew-1",
      email: "jane.smith@example.com",
      phone: "+1 555 123 4567",
      passportNumber: "P1234567",
      seamanBookNumber: "SB-111",
      role: "chief_engineer",
      updatedAt: "2026-06-01T00:00:00Z",
    };

    const first = service.anonymizeRecord(record, "crew", {
      ...baseConfig,
      level: "partial",
    });
    const second = service.anonymizeRecord(record, "crew", {
      ...baseConfig,
      level: "partial",
    });

    expect(first.record.id).toBe("crew-1");
    expect(first.record.role).toBe("chief_engineer");
    expect(first.record.updatedAt).toBe("2026-06-01T00:00:00Z");
    expect(first.record.email).toMatch(/^user_[a-f0-9]{8}@anonymized-[a-f0-9]{4}\.example\.com$/);
    expect(first.record.phone).toMatch(/^\+1-XXX-\d{3}-\d{4}$/);
    expect(first.record.passportNumber).toMatch(/^ANON-[A-F0-9]{12}$/);
    expect(first.record.seamanBookNumber).toMatch(/^ANON-[A-F0-9]{12}$/);
    expect(first.record).toEqual(second.record);
    expect(first.result).toEqual({
      originalFieldCount: 7,
      anonymizedFieldCount: 4,
      skippedFieldCount: 0,
    });
  });

  it("fully anonymizes nested PII, arrays, and likely contact strings without changing numbers", () => {
    const service = new DataAnonymizationService("fixed-salt");
    const record = {
      id: "wo-1",
      createdAt: "2026-06-02T00:00:00Z",
      status: "open",
      description: "Call John Smith at john.smith@example.com before pump inspection.",
      notes: ["Mary Jones", "Main engine pressure remains 4.5 bar"],
      assignedTechnician: {
        name: "Alex Walker",
        email: "alex.walker@example.com",
        phone: "+44 7000 123456",
        hours: 12,
      },
      readings: [4.5, 4.8],
    };

    const { record: anonymized, result } = service.anonymizeRecord(
      record,
      "work_orders",
      baseConfig
    );

    expect(anonymized.id).toBe("wo-1");
    expect(anonymized.createdAt).toBe("2026-06-02T00:00:00Z");
    expect(anonymized.status).toBe("open");
    expect(anonymized.description).not.toContain("john.smith@example.com");
    expect(anonymized.notes).not.toEqual(record.notes);
    expect(anonymized.assignedTechnician).toMatchObject({
      hours: 12,
    });
    expect(anonymized.assignedTechnician).not.toMatchObject({
      name: "Alex Walker",
      email: "alex.walker@example.com",
      phone: "+44 7000 123456",
    });
    expect(anonymized.readings).toEqual([4.5, 4.8]);
    expect(result.anonymizedFieldCount).toBeGreaterThanOrEqual(3);
    expect(result.skippedFieldCount).toBe(3);
  });

  it("builds aggregate anonymization reports without exposing the raw salt", () => {
    const service = new DataAnonymizationService("fixed-salt");
    const report = service.generateAnonymizationReport(
      {
        crew: { originalFieldCount: 10, anonymizedFieldCount: 4, skippedFieldCount: 2 },
        work_orders: { originalFieldCount: 5, anonymizedFieldCount: 1, skippedFieldCount: 1 },
      },
      baseConfig
    );

    expect(report.config).toEqual({
      level: "full",
      preserveIds: true,
      preserveTimestamps: true,
      preserveTechnicalData: true,
    });
    expect(report.summary).toEqual({
      totalFields: 15,
      anonymizedFields: 5,
      skippedFields: 3,
      anonymizationRate: "33.33%",
    });
    expect(report.saltHash).toHaveLength(16);
    expect(report.saltHash).not.toBe("fixed-salt");
    expect(new Date(report.timestamp).toString()).not.toBe("Invalid Date");
  });
});
