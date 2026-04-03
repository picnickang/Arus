/**
 * Certificate Application Service
 * Orchestrates domain logic using ports (interfaces)
 */

import type {
  ICertificateRepository,
  ICertificateEventRepository,
} from '../domain/ports';
import type {
  CertificateEntity,
  CreateCertificateCommand,
  UpdateCertificateCommand,
  CertificateSummary,
  ConditionOfClass,
  FlagStateEndorsement,
} from '../domain/types';

export class CertificateApplicationService {
  constructor(
    private readonly certificateRepo: ICertificateRepository,
    private readonly eventRepo: ICertificateEventRepository
  ) {}

  async listCertificates(orgId: string, filters?: {
    vesselId?: string;
    type?: string;
    status?: string;
  }) {
    return this.certificateRepo.findAll(orgId, filters);
  }

  async getCertificateById(id: string, orgId: string) {
    const cert = await this.certificateRepo.findById(id, orgId);
    if (!cert) return undefined;

    const events = await this.eventRepo.findByCertificateId(id);
    return { ...cert, events };
  }

  async getExpiring(orgId: string, days: number = 90) {
    return this.certificateRepo.findExpiring(orgId, days);
  }

  async getSummary(orgId: string, vesselId?: string): Promise<CertificateSummary> {
    return this.certificateRepo.getSummary(orgId, vesselId);
  }

  async createCertificate(
    command: CreateCertificateCommand,
    userId?: string
  ): Promise<CertificateEntity> {
    const cert = await this.certificateRepo.create(command);

    await this.eventRepo.create({
      orgId: cert.orgId,
      certificateId: cert.id,
      eventType: "issued",
      userId,
      details: {
        certificateType: cert.certificateType,
        issuingAuthority: cert.issuingAuthority,
      },
    });

    return cert;
  }

  async updateCertificate(
    id: string,
    orgId: string,
    updates: UpdateCertificateCommand,
    userId?: string
  ) {
    const updated = await this.certificateRepo.update(id, orgId, updates, userId);
    if (!updated) return undefined;

    if (updates.status) {
      await this.eventRepo.create({
        orgId,
        certificateId: id,
        eventType: updates.status === "valid" ? "reinstated" : updates.status,
        userId,
        details: updates,
      });
    }

    return updated;
  }

  async deleteCertificate(id: string, orgId: string): Promise<boolean> {
    return this.certificateRepo.delete(id, orgId);
  }

  async addCondition(
    id: string,
    orgId: string,
    condition: { description: string; dueDate: string; imposedDate?: string },
    userId?: string
  ) {
    const cert = await this.certificateRepo.findById(id, orgId);
    if (!cert) return undefined;

    const conditions = ((cert.conditionsOfClass as ConditionOfClass[]) || []).slice();
    const newCondition: ConditionOfClass = {
      id: `coc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: condition.description,
      dueDate: condition.dueDate,
      imposedDate: condition.imposedDate || new Date().toISOString().split("T")[0],
      status: "open",
    };
    conditions.push(newCondition);

    const updated = await this.certificateRepo.updateConditions(id, orgId, conditions);

    await this.eventRepo.create({
      orgId,
      certificateId: id,
      eventType: "condition_added",
      userId,
      details: newCondition,
    });

    return { condition: newCondition, certificate: updated };
  }

  async updateConditionStatus(
    id: string,
    orgId: string,
    conditionId: string,
    status: "open" | "closed",
    userId?: string
  ) {
    const cert = await this.certificateRepo.findById(id, orgId);
    if (!cert) return undefined;

    const conditions = ((cert.conditionsOfClass as ConditionOfClass[]) || []).map((c) => {
      if (c.id === conditionId) {
        return {
          ...c,
          status,
          closedDate: status === "closed" ? new Date().toISOString().split("T")[0] : undefined,
          closedBy: status === "closed" ? userId : undefined,
        };
      }
      return c;
    });

    const updated = await this.certificateRepo.updateConditions(id, orgId, conditions as ConditionOfClass[]);

    await this.eventRepo.create({
      orgId,
      certificateId: id,
      eventType: status === "closed" ? "condition_closed" : "condition_reopened",
      userId,
      details: { conditionId, status },
    });

    return updated;
  }

  async addEndorsement(
    id: string,
    orgId: string,
    endorsement: FlagStateEndorsement,
    userId?: string
  ) {
    const cert = await this.certificateRepo.findById(id, orgId);
    if (!cert) return undefined;

    const endorsements = ((cert.endorsements as FlagStateEndorsement[]) || []).slice();
    endorsements.push(endorsement);

    const updated = await this.certificateRepo.updateEndorsements(id, orgId, endorsements);

    await this.eventRepo.create({
      orgId,
      certificateId: id,
      eventType: "endorsement_added",
      userId,
      details: endorsement,
    });

    return updated;
  }
}
