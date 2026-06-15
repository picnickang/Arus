/**
 * Typed fixtures for crew email-notification tests. Each builder returns a
 * complete `$inferSelect` row (no `as unknown as` casts — tsc enforces
 * completeness), with overrides for the few fields the notification paths read.
 */
import type { Crew, CrewCertification, CrewDocument } from "@shared/schema";

export function makeCrew(overrides: Partial<Crew> = {}): Crew {
  return {
    id: "crew-1",
    orgId: "org-1",
    name: "Jane Mariner",
    email: "jane@vessel.test",
    phone: null,
    address: null,
    photoPath: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    crewCode: null,
    status: "active",
    employmentType: null,
    reportsToId: null,
    rotationOnDays: null,
    rotationOffDays: null,
    rank: "Chief Engineer",
    department: null,
    watchKeeping: null,
    roleId: null,
    userId: null,
    vesselId: null,
    maxHours7d: 72,
    minRestH: 10,
    active: true,
    onDuty: false,
    notes: null,
    hourlyRate: null,
    startDate: null,
    contractEndDate: null,
    contractPenalty: null,
    terminationType: null,
    terminationDate: null,
    terminationNotes: null,
    reinstatedAt: null,
    reinstatedBy: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

export function makeCrewCertification(
  overrides: Partial<CrewCertification> = {}
): CrewCertification {
  return {
    id: "cert-1",
    orgId: "org-1",
    crewId: "crew-1",
    cert: "STCW Basic Safety Training",
    certNumber: "STCW-12345",
    expiresAt: new Date("2026-07-01"),
    issuedAt: null,
    issuedBy: null,
    alertSent: false,
    alertSent30: false,
    alertSent60: false,
    alertSent90: false,
    alertLastScannedAt: null,
    alertAcknowledged: false,
    alertAcknowledgedAt: null,
    alertAcknowledgedBy: null,
    alertAcknowledgedNotes: null,
    createdAt: null,
    ...overrides,
  };
}

export function makeCrewDocument(overrides: Partial<CrewDocument> = {}): CrewDocument {
  return {
    id: "doc-1",
    orgId: "org-1",
    crewId: "crew-1",
    documentType: "Seaman's Book",
    documentNumber: "SB-67890",
    filePath: null,
    issuingAuthority: null,
    issuingCountry: null,
    issuedAt: null,
    expiresAt: new Date("2026-07-01"),
    alertSent: false,
    alertSent30: false,
    alertSent60: false,
    alertSent90: false,
    alertLastScannedAt: null,
    alertAcknowledged: false,
    alertAcknowledgedAt: null,
    alertAcknowledgedBy: null,
    alertAcknowledgedNotes: null,
    notes: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}
