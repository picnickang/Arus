/**
 * Immutable Audit Trail Service
 *
 * Modular entry point for tamper-evident audit logging with cryptographic hash chaining.
 * Implements requirements for:
 * - ISM Code Section 10.4: Verification and records
 * - Class Society Audit Requirements
 * - IMO 2021 Cybersecurity Guidelines
 *
 * @see ./types.ts - Type definitions
 * @see ./hashing.ts - Hash computation
 * @see ./log-event-postgres.ts - PostgreSQL logging
 * @see ./log-event-sqlite.ts - SQLite logging
 * @see ./query.ts - Query operations
 * @see ./verify.ts - Chain verification
 * @see ./convenience-loggers.ts - Pre-configured loggers
 */

import { IS_POSTGRES, IS_SQLITE } from '@shared/schema-runtime';
import { logEventPostgres } from './log-event-postgres';
import { logEventSqlite } from './log-event-sqlite';
import { queryAuditEvents } from './query';
import { verifyAuditChain } from './verify';
import { createConvenienceLoggers } from './convenience-loggers';
import type {
  AuditEventInput,
  AuditRecord,
  AuditQueryOptions,
  ChainVerificationResult,
  AuditStats,
} from './types';

export * from './types';

class ImmutableAuditService {
  private static instance: ImmutableAuditService;
  private convenienceLoggers: ReturnType<typeof createConvenienceLoggers>;

  private constructor() {
    this.convenienceLoggers = createConvenienceLoggers(this.logEvent.bind(this));
  }

  public static getInstance(): ImmutableAuditService {
    if (!ImmutableAuditService.instance) {
      ImmutableAuditService.instance = new ImmutableAuditService();
    }
    return ImmutableAuditService.instance;
  }

  async logEvent(input: AuditEventInput): Promise<AuditRecord> {
    if (IS_POSTGRES) {
      return logEventPostgres(input);
    } if (IS_SQLITE) {
      return logEventSqlite(input);
    } 
      throw new Error('No database mode configured');
    
  }

  async queryEvents(options: AuditQueryOptions): Promise<AuditRecord[]> {
    return queryAuditEvents(options);
  }

  async verifyChain(
    orgId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ChainVerificationResult> {
    return verifyAuditChain(orgId, startDate, endDate);
  }

  async getStats(
    orgId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditStats> {
    const events = await this.queryEvents({
      orgId,
      startDate,
      endDate,
      limit: 10000,
    });

    const eventsByCategory: Record<string, number> = {};
    const eventsByType: Record<string, number> = {};

    for (const event of events) {
      eventsByCategory[event.eventCategory] = (eventsByCategory[event.eventCategory] ?? 0) + 1;
      eventsByType[event.eventType] = (eventsByType[event.eventType] ?? 0) + 1;
    }

    const chainIntegrity = await this.verifyChain(orgId, startDate, endDate);

    return {
      totalEvents: events.length,
      eventsByCategory,
      eventsByType,
      chainIntegrity,
    };
  }

  get logLogin() { return this.convenienceLoggers.logLogin; }
  get logDataChange() { return this.convenienceLoggers.logDataChange; }
  get logMLPrediction() { return this.convenienceLoggers.logMLPrediction; }
  get logPredictionOverride() { return this.convenienceLoggers.logPredictionOverride; }
  get logWorkOrderAction() { return this.convenienceLoggers.logWorkOrderAction; }
  get logSecurityEvent() { return this.convenienceLoggers.logSecurityEvent; }
  get logComplianceEvent() { return this.convenienceLoggers.logComplianceEvent; }
}

export const auditService = ImmutableAuditService.getInstance();
export default auditService;
