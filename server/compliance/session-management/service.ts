/**
 * Session Management - Main Service Class
 */

import type { UserSession, LoginEvent } from "@shared/schema";
import type {
  SessionConfig,
  TokenPair,
  SessionValidationResult,
  LoginEventInput,
  CreateSessionOptions,
  SuspiciousActivityResult,
} from "./types.js";
import { DEFAULT_SESSION_CONFIG } from "./types.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { hashToken } from "./token-utils.js";
import {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  enforceMaxSessions,
} from "./session-ops.js";
import {
  cleanupExpiredSessions,
  getUserSessions,
  getSessionByRefreshToken,
} from "./session-queries.js";
import { logLoginEvent, getLoginEvents, detectSuspiciousActivity } from "./login-events.js";

class SessionManagementService {
  private static instance: SessionManagementService;
  private config: SessionConfig = { ...DEFAULT_SESSION_CONFIG };

  private constructor() {}

  public static getInstance(): SessionManagementService {
    if (!SessionManagementService.instance) {
      SessionManagementService.instance = new SessionManagementService();
    }
    return SessionManagementService.instance;
  }

  public configure(config: Partial<SessionConfig>): void {
    Object.assign(this.config, config);
  }

  async createSession(
    orgId: string,
    userId: string,
    options?: CreateSessionOptions
  ): Promise<{ session: UserSession; tokens: TokenPair }> {
    await enforceMaxSessions(orgId, userId, this.config, this.revokeSession.bind(this));
    return createSession(orgId, userId, this.config, options);
  }

  async validateSession(
    sessionToken: string,
    options?: { updateActivity?: boolean; orgId?: string }
  ): Promise<SessionValidationResult> {
    return validateSession(sessionToken, this.config, options);
  }

  async refreshSession(
    refreshToken: string
  ): Promise<{ session: UserSession; tokens: TokenPair } | null> {
    const hashedToken = hashToken(refreshToken);
    const oldSession = await getSessionByRefreshToken(hashedToken);
    if (!oldSession || oldSession.isRevoked) {
      return null;
    }

    if (oldSession.refreshExpiresAt && oldSession.refreshExpiresAt < new Date()) {
      return null;
    }

    await this.revokeSession(oldSession.id, "system", "Token rotation");
    return this.createSession(oldSession.orgId, oldSession.userId, {
      ipAddress: oldSession.ipAddress ?? undefined,
      userAgent: oldSession.userAgent ?? undefined,
      deviceFingerprint: oldSession.deviceFingerprint ?? undefined,
      geoLocation: oldSession.geoLocation as Record<string, unknown> | undefined,
      mfaVerified: oldSession.mfaVerified ?? false,
    });
  }

  async revokeSession(sessionId: string, revokedBy: string, reason: string): Promise<boolean> {
    return revokeSession(sessionId, revokedBy, reason);
  }

  async revokeAllUserSessions(
    orgId: string,
    userId: string,
    revokedBy: string,
    reason: string
  ): Promise<number> {
    return revokeAllUserSessions(orgId, userId, revokedBy, reason);
  }

  async cleanupExpiredSessions(): Promise<number> {
    return cleanupExpiredSessions();
  }

  async getUserSessions(orgId: string, userId: string): Promise<UserSession[]> {
    return getUserSessions(orgId, userId);
  }

  async logLoginEvent(input: LoginEventInput): Promise<LoginEvent> {
    return logLoginEvent(input);
  }

  async getLoginEvents(
    orgId: string,
    options?: {
      userId?: string;
      outcome?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<LoginEvent[]> {
    return getLoginEvents(orgId, options);
  }

  async flagSuspiciousSession(
    sessionId: string,
    flagType: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.logLoginEvent({
      orgId: DEFAULT_ORG_ID,
      userId: "system",
      eventType: "suspicious_flag",
      success: false,
      metadata: { sessionId, flagType, ...(metadata ?? {}) },
    } as object as LoginEventInput);
  }

  async detectSuspiciousActivity(
    ipAddress: string,
    minutes?: number
  ): Promise<SuspiciousActivityResult> {
    return detectSuspiciousActivity(ipAddress, minutes);
  }
}

export const sessionManagementService = SessionManagementService.getInstance();
export { SessionManagementService };
