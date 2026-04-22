/**
 * Session Management - Type Definitions
 */

import type { UserSession } from "@shared/schema";

export interface SessionConfig {
  sessionDurationMinutes: number;
  refreshTokenDurationDays: number;
  inactivityTimeoutMinutes: number;
  maxConcurrentSessions: number;
}

export interface TokenPair {
  sessionToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: UserSession;
  expired?: boolean;
  revoked?: boolean;
  inactivityTimeout?: boolean;
  error?: string;
}

export interface LoginEventInput {
  orgId?: string;
  userId?: string;
  attemptedEmail?: string;
  loginType: "password" | "sso" | "api_key" | "refresh_token" | "device_hmac";
  outcome: "success" | "failure" | "locked" | "mfa_required" | "mfa_failed";
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
  geoLocation?: Record<string, unknown>;
  deviceFingerprint?: string;
  suspiciousIndicators?: string[];
  riskScore?: number;
  sessionId?: string;
}

export interface CreateSessionOptions {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geoLocation?: Record<string, unknown>;
  mfaVerified?: boolean;
}

export interface SuspiciousActivityResult {
  failedAttempts: number;
  uniqueIps: number;
  suspicious: boolean;
  indicators: string[];
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  sessionDurationMinutes: 60,
  refreshTokenDurationDays: 7,
  inactivityTimeoutMinutes: 30,
  maxConcurrentSessions: 5,
};
