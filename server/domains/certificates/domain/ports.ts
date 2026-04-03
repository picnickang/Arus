/**
 * Certificate Domain - Ports (Interfaces)
 * Define contracts for infrastructure adapters
 */

import type {
  CertificateEntity,
  CreateCertificateCommand,
  UpdateCertificateCommand,
  CertificateEventEntity,
  CertificateSummary,
  ConditionOfClass,
  FlagStateEndorsement,
} from './types';

export interface ICertificateRepository {
  findAll(orgId: string, filters?: {
    vesselId?: string;
    type?: string;
    status?: string;
  }): Promise<Array<CertificateEntity & { vesselName?: string }>>;

  findById(id: string, orgId: string): Promise<(CertificateEntity & { vesselName?: string }) | undefined>;

  findExpiring(orgId: string, days: number): Promise<Array<CertificateEntity & { vesselName?: string; daysUntilExpiry: number | null }>>;

  getSummary(orgId: string, vesselId?: string): Promise<CertificateSummary>;

  create(command: CreateCertificateCommand): Promise<CertificateEntity>;

  update(id: string, orgId: string, updates: UpdateCertificateCommand, updatedBy?: string): Promise<CertificateEntity | undefined>;

  delete(id: string, orgId: string): Promise<boolean>;

  updateConditions(id: string, orgId: string, conditions: ConditionOfClass[]): Promise<CertificateEntity | undefined>;

  updateEndorsements(id: string, orgId: string, endorsements: FlagStateEndorsement[]): Promise<CertificateEntity | undefined>;
}

export interface ICertificateEventRepository {
  findByCertificateId(certificateId: string): Promise<CertificateEventEntity[]>;

  create(event: {
    orgId: string;
    certificateId: string;
    eventType: string;
    userId?: string;
    details?: unknown;
  }): Promise<CertificateEventEntity>;
}
