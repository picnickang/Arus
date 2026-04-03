/**
 * Certificate Domain - Domain Types
 * Pure domain types without infrastructure dependencies
 */

export interface CertificateEntity {
  id: string;
  orgId: string;
  vesselId: string;
  certificateType: string;
  certificateNumber: string | null;
  certificateName: string;
  issuingAuthority: string;
  issuingAuthorityType: string;
  issueDate: Date;
  expiryDate: Date | null;
  lastSurveyDate: Date | null;
  nextSurveyDue: Date | null;
  surveyWindowStart: Date | null;
  surveyWindowEnd: Date | null;
  status: 'valid' | 'expired' | 'suspended' | 'withdrawn' | 'pending_renewal';
  conditionsOfClass: ConditionOfClass[];
  endorsements: FlagStateEndorsement[];
  surveyId: string | null;
  equipmentId: string | null;
  documentUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ConditionOfClass {
  id: string;
  description: string;
  dueDate: string;
  status: 'open' | 'closed' | 'overdue';
  imposedDate: string;
  closedDate?: string;
  closedBy?: string;
}

export interface FlagStateEndorsement {
  flagState: string;
  endorsementNumber: string;
  issueDate: string;
  expiryDate?: string;
}

export interface CreateCertificateCommand {
  orgId: string;
  vesselId: string;
  certificateType: string;
  certificateName: string;
  certificateNumber?: string;
  issuingAuthority: string;
  issuingAuthorityType?: string;
  issueDate: string;
  expiryDate?: string;
  nextSurveyDue?: string;
  surveyWindowStart?: string;
  surveyWindowEnd?: string;
  equipmentId?: string;
  surveyId?: string;
  notes?: string;
  documentUrl?: string;
}

export interface UpdateCertificateCommand {
  status?: string;
  certificateNumber?: string;
  expiryDate?: string | null;
  nextSurveyDue?: string | null;
  lastSurveyDate?: string;
  surveyWindowStart?: string | null;
  surveyWindowEnd?: string | null;
  surveyId?: string;
  notes?: string;
  documentUrl?: string | null;
}

export interface CertificateEventEntity {
  id: string;
  orgId: string;
  certificateId: string;
  eventType: string;
  userId: string | null;
  details: unknown;
  createdAt: Date | null;
}

export interface CertificateSummary {
  totalCertificates: number;
  valid: number;
  expired: number;
  suspended: number;
  pendingRenewal: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
  surveysDueIn90Days: number;
  openConditionsOfClass: number;
  expiredCertificates: Array<{
    id: string;
    certificateName: string;
    certificateType: string;
    expiryDate: Date | null;
    vesselId: string;
  }>;
}
