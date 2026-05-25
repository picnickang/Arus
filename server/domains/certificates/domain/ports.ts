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
} from "./types";

export interface ICertificateRepository {
  findAll(
    orgId: string,
    filters?: {
      vesselId?: string | undefined;
      type?: string | undefined;
      status?: string | undefined;
    }
  ): Promise<Array<CertificateEntity & { vesselName?: string | undefined }>>;

  findById(
    id: string,
    orgId: string
  ): Promise<(CertificateEntity & { vesselName?: string | undefined }) | undefined>;

  findExpiring(
    orgId: string,
    days: number
  ): Promise<Array<CertificateEntity & { vesselName?: string | undefined; daysUntilExpiry: number | null }>>;

  getSummary(orgId: string, vesselId?: string): Promise<CertificateSummary>;

  create(command: CreateCertificateCommand): Promise<CertificateEntity>;

  update(
    id: string,
    orgId: string,
    updates: UpdateCertificateCommand,
    updatedBy?: string
  ): Promise<CertificateEntity | undefined>;

  delete(id: string, orgId: string): Promise<boolean>;

  updateConditions(
    id: string,
    orgId: string,
    conditions: ConditionOfClass[]
  ): Promise<CertificateEntity | undefined>;

  updateEndorsements(
    id: string,
    orgId: string,
    endorsements: FlagStateEndorsement[]
  ): Promise<CertificateEntity | undefined>;
}

export interface ICertificateEventRepository {
  findByCertificateId(certificateId: string, orgId?: string): Promise<CertificateEventEntity[]>;

  create(event: {
    orgId: string;
    certificateId: string;
    eventType: string;
    userId?: string | undefined;
    details?: unknown;
  }): Promise<CertificateEventEntity>;
}
