/**
 * RAG Security Audit Logger
 * Logs all RAG operations for security and compliance
 */

import { logger } from "../../../utils/logger.js";
import type { RagSecurityConfig } from "./types.js";

export type AuditEventType =
  | "query"
  | "query_response"
  | "document_access"
  | "document_upload"
  | "document_delete"
  | "rate_limit_exceeded"
  | "auth_failure"
  | "prompt_injection_attempt"
  | "file_validation_failure"
  | "streaming_token_issued"
  | "streaming_token_used"
  | "config_change";

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  orgId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
  details: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

interface AuditLogStore {
  events: AuditEvent[];
  maxSize: number;
}

const auditStore: AuditLogStore = {
  events: [],
  maxSize: 10000,
};

export class RagAuditLogger {
  private config: RagSecurityConfig["audit"];
  private eventQueue: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: RagSecurityConfig["audit"]) {
    this.config = config;

    if (config.enabled) {
      // Flush events periodically
      this.flushInterval = setInterval(() => this.flushEvents(), 10000);
    }
  }

  /**
   * Log a query event
   */
  logQuery(params: {
    userId?: string;
    orgId?: string;
    ipAddress?: string;
    query: string;
    sanitized?: boolean;
    blockedPatterns?: string[];
  }): void {
    if (!this.config.enabled || !this.config.logQueries) {
      return;
    }

    this.addEvent({
      eventType: "query",
      userId: params.userId,
      orgId: params.orgId,
      ipAddress: params.ipAddress,
      details: {
        queryLength: params.query.length,
        sanitized: params.sanitized,
        blockedPatterns: params.blockedPatterns,
        // Don't log full query for privacy - just first 100 chars
        queryPreview: params.query.slice(0, 100),
      },
      success: true,
    });
  }

  /**
   * Log a response event
   */
  logResponse(params: {
    userId?: string;
    orgId?: string;
    conversationId: string;
    responseLength: number;
    chunksUsed: number;
    confidence?: number;
    cached: boolean;
    duration: number;
  }): void {
    if (!this.config.enabled || !this.config.logResponses) {
      return;
    }

    this.addEvent({
      eventType: "query_response",
      userId: params.userId,
      orgId: params.orgId,
      resourceId: params.conversationId,
      resourceType: "conversation",
      details: {
        responseLength: params.responseLength,
        chunksUsed: params.chunksUsed,
        confidence: params.confidence,
        cached: params.cached,
        durationMs: params.duration,
      },
      success: true,
    });
  }

  /**
   * Log document access
   */
  logDocumentAccess(params: {
    userId?: string;
    orgId?: string;
    documentId: string;
    documentName?: string;
    action: "view" | "download" | "search";
  }): void {
    if (!this.config.enabled || !this.config.logDocumentAccess) {
      return;
    }

    this.addEvent({
      eventType: "document_access",
      userId: params.userId,
      orgId: params.orgId,
      resourceId: params.documentId,
      resourceType: "document",
      details: {
        action: params.action,
        documentName: params.documentName,
      },
      success: true,
    });
  }

  /**
   * Log document upload
   */
  logDocumentUpload(params: {
    userId?: string;
    orgId?: string;
    ipAddress?: string;
    filename: string;
    fileSize: number;
    mimeType?: string;
    success: boolean;
    errorMessage?: string;
    quarantined?: boolean;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    this.addEvent({
      eventType: "document_upload",
      userId: params.userId,
      orgId: params.orgId,
      ipAddress: params.ipAddress,
      details: {
        filename: params.filename,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        quarantined: params.quarantined,
      },
      success: params.success,
      errorMessage: params.errorMessage,
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(params: {
    userId?: string;
    orgId?: string;
    ipAddress?: string;
    identifier: string;
    retryAfter: number;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    this.addEvent({
      eventType: "rate_limit_exceeded",
      userId: params.userId,
      orgId: params.orgId,
      ipAddress: params.ipAddress,
      details: {
        identifier: params.identifier,
        retryAfter: params.retryAfter,
      },
      success: false,
    });

    logger.warn("RagAudit", "Rate limit exceeded", {
      userId: params.userId,
      orgId: params.orgId,
      ip: params.ipAddress,
    });
  }

  /**
   * Log authentication failure
   */
  logAuthFailure(params: {
    ipAddress?: string;
    userAgent?: string;
    reason: string;
    attemptedOrgId?: string;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    this.addEvent({
      eventType: "auth_failure",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: {
        reason: params.reason,
        attemptedOrgId: params.attemptedOrgId,
      },
      success: false,
      errorMessage: params.reason,
    });

    logger.warn("RagAudit", "Authentication failure", {
      ip: params.ipAddress,
      reason: params.reason,
    });
  }

  /**
   * Log prompt injection attempt
   */
  logPromptInjectionAttempt(params: {
    userId?: string;
    orgId?: string;
    ipAddress?: string;
    blockedPatterns: string[];
    queryPreview: string;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    this.addEvent({
      eventType: "prompt_injection_attempt",
      userId: params.userId,
      orgId: params.orgId,
      ipAddress: params.ipAddress,
      details: {
        blockedPatterns: params.blockedPatterns,
        queryPreview: params.queryPreview.slice(0, 200),
      },
      success: false,
      errorMessage: "Potential prompt injection detected",
    });

    logger.warn("RagAudit", "Prompt injection attempt detected", {
      userId: params.userId,
      patterns: params.blockedPatterns,
    });
  }

  /**
   * Log file validation failure
   */
  logFileValidationFailure(params: {
    userId?: string;
    orgId?: string;
    ipAddress?: string;
    filename: string;
    errors: string[];
    warnings: string[];
    quarantined: boolean;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    this.addEvent({
      eventType: "file_validation_failure",
      userId: params.userId,
      orgId: params.orgId,
      ipAddress: params.ipAddress,
      details: {
        filename: params.filename,
        errors: params.errors,
        warnings: params.warnings,
        quarantined: params.quarantined,
      },
      success: false,
      errorMessage: params.errors.join("; "),
    });
  }

  private addEvent(event: Omit<AuditEvent, "id" | "timestamp">): void {
    const fullEvent: AuditEvent = {
      id: `rag-audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
      ...event,
    };

    this.eventQueue.push(fullEvent);

    // Keep queue size manageable
    if (this.eventQueue.length > 100) {
      this.flushEvents();
    }
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Add to in-memory store
    auditStore.events.push(...events);

    // Trim if over max size
    if (auditStore.events.length > auditStore.maxSize) {
      auditStore.events = auditStore.events.slice(-auditStore.maxSize);
    }

    // In a production system, this would also persist to database
    logger.debug("RagAudit", `Flushed ${events.length} audit events`);
  }

  /**
   * Get recent audit events
   */
  getEvents(params: {
    limit?: number;
    eventType?: AuditEventType;
    userId?: string;
    orgId?: string;
    startTime?: Date;
    endTime?: Date;
  }): AuditEvent[] {
    let filtered = [...auditStore.events];

    if (params.eventType) {
      filtered = filtered.filter((e) => e.eventType === params.eventType);
    }
    if (params.userId) {
      filtered = filtered.filter((e) => e.userId === params.userId);
    }
    if (params.orgId) {
      filtered = filtered.filter((e) => e.orgId === params.orgId);
    }
    if (params.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= params.startTime!);
    }
    if (params.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= params.endTime!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filtered.slice(0, params.limit || 100);
  }

  /**
   * Get audit statistics
   */
  getStats(orgId?: string): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    failedEvents: number;
    rateLimitEvents: number;
    injectionAttempts: number;
  } {
    let events = auditStore.events;
    if (orgId) {
      events = events.filter((e) => e.orgId === orgId);
    }

    const eventsByType: Record<string, number> = {};
    let failedEvents = 0;
    let rateLimitEvents = 0;
    let injectionAttempts = 0;

    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      if (!event.success) {
        failedEvents++;
      }
      if (event.eventType === "rate_limit_exceeded") {
        rateLimitEvents++;
      }
      if (event.eventType === "prompt_injection_attempt") {
        injectionAttempts++;
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      failedEvents,
      rateLimitEvents,
      injectionAttempts,
    };
  }

  updateConfig(config: RagSecurityConfig["audit"]): void {
    this.config = config;

    if (config.enabled && !this.flushInterval) {
      this.flushInterval = setInterval(() => this.flushEvents(), 10000);
    } else if (!config.enabled && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEvents();
  }
}

let instance: RagAuditLogger | null = null;

export function getRagAuditLogger(config: RagSecurityConfig["audit"]): RagAuditLogger {
  if (!instance) {
    instance = new RagAuditLogger(config);
  }
  return instance;
}

export function updateAuditLoggerConfig(config: RagSecurityConfig["audit"]): void {
  if (instance) {
    instance.updateConfig(config);
  }
}
