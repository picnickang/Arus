/**
 * Compliance Storage Interface - Audit Logs, Bundles, Findings, Rules, DSAR
 * Part of IStorage modularization for improved maintainability
 */

import type {
  ComplianceAuditLog,
  InsertComplianceAuditLog,
  ComplianceBundle,
  InsertComplianceBundle,
  ComplianceFinding,
  InsertComplianceFinding,
  ComplianceRule,
  InsertComplianceRule,
  DataSubjectRequest,
  InsertDataSubjectRequest,
  EngineerOverride,
  InsertEngineerOverride,
} from "@shared/schema";

/**
 * Compliance storage operations for audit trails, findings, and GDPR
 */
export interface IComplianceStorage {
  // Compliance Audit Log
  logComplianceAction(data: InsertComplianceAuditLog): Promise<ComplianceAuditLog>;
  getComplianceAuditLog(filters?: {
    entityType?: string;
    entityId?: string;
    complianceStandard?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ComplianceAuditLog[]>;

  // Compliance Bundles
  getComplianceBundles(orgId?: string): Promise<ComplianceBundle[]>;
  createComplianceBundle(bundle: InsertComplianceBundle): Promise<ComplianceBundle>;
  getComplianceBundle(bundleId: string, orgId?: string): Promise<ComplianceBundle | undefined>;
  deleteComplianceBundle(id: string): Promise<void>;

  // Compliance Findings
  getComplianceFindings(
    orgId: string,
    filters?: {
      vesselId?: string;
      sourceType?: string;
      severity?: string;
      status?: string;
      ruleCode?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ComplianceFinding[]>;
  getComplianceFindingById(id: string, orgId: string): Promise<ComplianceFinding | undefined>;
  createComplianceFinding(finding: InsertComplianceFinding): Promise<ComplianceFinding>;
  updateComplianceFinding(
    id: string,
    finding: Partial<InsertComplianceFinding>,
    orgId: string
  ): Promise<ComplianceFinding>;
  acknowledgeComplianceFinding(
    id: string,
    ackData: { acknowledgedByUserId: string; acknowledgedByUserName: string },
    orgId: string
  ): Promise<ComplianceFinding>;
  resolveComplianceFinding(
    id: string,
    resolveData: { resolvedByUserId: string; resolvedByUserName: string; resolutionNotes?: string },
    orgId: string
  ): Promise<ComplianceFinding>;
  suppressComplianceFinding(
    id: string,
    suppressData: { suppressedUntil: Date; suppressedReason: string },
    orgId: string
  ): Promise<ComplianceFinding>;
  deleteComplianceFinding(id: string, orgId: string): Promise<void>;

  // Compliance Rules
  getComplianceRules(
    orgId: string,
    filters?: { sourceType?: string; category?: string; enabled?: boolean }
  ): Promise<ComplianceRule[]>;
  getComplianceRuleById(id: string, orgId: string): Promise<ComplianceRule | undefined>;
  getComplianceRuleByCode(ruleCode: string, orgId: string): Promise<ComplianceRule | undefined>;
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  updateComplianceRule(
    id: string,
    rule: Partial<InsertComplianceRule>,
    orgId: string
  ): Promise<ComplianceRule>;
  deleteComplianceRule(id: string, orgId: string): Promise<void>;

  // Data Subject Requests (GDPR/DSAR)
  getDataSubjectRequests(
    orgId: string,
    filters?: {
      status?: string;
      requestType?: string;
      requesterEmail?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<DataSubjectRequest[]>;
  getDataSubjectRequest(id: string, orgId: string): Promise<DataSubjectRequest | undefined>;
  createDataSubjectRequest(request: InsertDataSubjectRequest): Promise<DataSubjectRequest>;
  updateDataSubjectRequest(
    id: string,
    request: Partial<InsertDataSubjectRequest>,
    orgId: string
  ): Promise<DataSubjectRequest>;
  deleteDataSubjectRequest(id: string, orgId: string): Promise<void>;
  acknowledgeDataSubjectRequest(
    id: string,
    acknowledgedBy: string,
    orgId: string
  ): Promise<DataSubjectRequest>;
  completeDataSubjectRequest(
    id: string,
    completionData: {
      responseType: string;
      responseNotes?: string;
      exportPath?: string;
      deletionConfirmation?: Record<string, unknown>;
    },
    orgId: string
  ): Promise<DataSubjectRequest>;
  rejectDataSubjectRequest(
    id: string,
    rejectionReason: string,
    orgId: string
  ): Promise<DataSubjectRequest>;
  collectUserDataForDsar(
    orgId: string,
    identifier: string,
    identifierType: "email" | "userId" | "crewId"
  ): Promise<{
    personalInfo: Record<string, unknown>;
    workHistory: Record<string, unknown>[];
    certifications: Record<string, unknown>[];
    assignments: Record<string, unknown>[];
    auditTrail: Record<string, unknown>[];
  }>;
  executeDataErasure(
    orgId: string,
    identifier: string,
    identifierType: "email" | "userId" | "crewId",
    retentionExemptCategories?: string[]
  ): Promise<{
    deletedRecords: { table: string; count: number }[];
    retainedRecords: { table: string; count: number; reason: string }[];
    anonymizedRecords: { table: string; count: number }[];
  }>;

  // Engineer Overrides
  getEngineerOverrides(
    orgId: string,
    filters?: {
      equipmentId?: string | undefined;
      engineerId?: string | undefined;
      overrideType?: string | undefined;
      outcomeStatus?: string | undefined;
      fromDate?: Date | undefined;
      toDate?: Date | undefined;
    }
  ): Promise<EngineerOverride[]>;
  getEngineerOverride(id: string, orgId: string): Promise<EngineerOverride | undefined>;
  createEngineerOverride(override: InsertEngineerOverride): Promise<EngineerOverride>;
  updateEngineerOverrideOutcome(
    id: string,
    outcomeData: { outcomeStatus: string; outcomeNotes?: string; outcomeRecordedBy: string },
    orgId: string
  ): Promise<EngineerOverride>;
}
