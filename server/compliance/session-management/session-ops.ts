/**
 * Session Management - Session Operations
 */

import { db } from "../../db";
import { userSessions } from "@shared/schema-runtime";
import { eq, and, sql } from "drizzle-orm";
import type { UserSession } from "@shared/schema";
import type {
  SessionConfig,
  TokenPair,
  SessionValidationResult,
  CreateSessionOptions,
} from "./types.js";
import { generateToken, hashToken } from "./token-utils.js";

export async function enforceMaxSessions(
  orgId: string,
  userId: string,
  config: SessionConfig,
  revokeSession: (id: string, by: string, reason: string) => Promise<boolean>
): Promise<void> {
  const activeSessions = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.orgId, orgId),
        eq(userSessions.userId, userId),
        eq(userSessions.isRevoked, false)
      )
    )
    .orderBy(sql`${userSessions.createdAt} DESC`);

  if (activeSessions.length >= config.maxConcurrentSessions) {
    const sessionsToRevoke = activeSessions.slice(config.maxConcurrentSessions - 1);
    for (const session of sessionsToRevoke) {
      await revokeSession(session.id, "system", "Maximum concurrent sessions exceeded");
    }
  }
}

export async function createSession(
  orgId: string,
  userId: string,
  config: SessionConfig,
  options?: CreateSessionOptions
): Promise<{ session: UserSession; tokens: TokenPair }> {
  const now = new Date();
  const sessionToken = generateToken();
  const refreshToken = generateToken();
  const expiresAt = new Date(now.getTime() + config.sessionDurationMinutes * 60 * 1000);
  const refreshExpiresAt = new Date(
    now.getTime() + config.refreshTokenDurationDays * 24 * 60 * 60 * 1000
  );
  const id = crypto.randomUUID();

  const sessionData = {
    id,
    orgId,
    userId,
    sessionToken: hashToken(sessionToken),
    refreshToken: hashToken(refreshToken),
    tokenVersion: 1,
    expiresAt,
    refreshExpiresAt,
    lastActivityAt: now,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    deviceFingerprint: options?.deviceFingerprint,
    geoLocation: options?.geoLocation,
    isRevoked: false,
    mfaVerified: options?.mfaVerified ?? false,
    mfaVerifiedAt: options?.mfaVerified ? now : null,
    createdAt: now,
  };

  await db.insert(userSessions).values(sessionData);

  const session = {
    ...sessionData,
    revokedAt: null,
    revokedBy: null,
    revokedReason: null,
  } as UserSession;
  return { session, tokens: { sessionToken, refreshToken, expiresAt, refreshExpiresAt } };
}

export async function validateSession(
  sessionToken: string,
  config: SessionConfig,
  options?: { updateActivity?: boolean; orgId?: string }
): Promise<SessionValidationResult> {
  const hashedToken = hashToken(sessionToken);
  const now = new Date();
  const conditions = [eq(userSessions.sessionToken, hashedToken)];
  if (options?.orgId) {
    conditions.push(eq(userSessions.orgId, options.orgId));
  }

  const sessions = await db
    .select()
    .from(userSessions)
    .where(and(...conditions))
    .limit(1);
  const session = sessions[0];

  if (!session) {
    return { valid: false, error: "Session not found" };
  }
  if (session.isRevoked) {
    return { valid: false, session, revoked: true, error: "Session has been revoked" };
  }
  if (session.expiresAt < now) {
    return { valid: false, session, expired: true, error: "Session has expired" };
  }

  const inactivityLimit = new Date(now.getTime() - config.inactivityTimeoutMinutes * 60 * 1000);
  if (session.lastActivityAt && session.lastActivityAt < inactivityLimit) {
    return {
      valid: false,
      session,
      inactivityTimeout: true,
      error: "Session timed out due to inactivity",
    };
  }

  if (options?.updateActivity !== false) {
    await db
      .update(userSessions)
      .set({ lastActivityAt: now })
      .where(eq(userSessions.id, session.id));
  }

  return { valid: true, session };
}

export async function revokeSession(
  sessionId: string,
  revokedBy: string,
  reason: string
): Promise<boolean> {
  await db
    .update(userSessions)
    .set({ isRevoked: true, revokedAt: new Date(), revokedBy, revokedReason: reason })
    .where(eq(userSessions.id, sessionId));
  return true;
}

export async function revokeAllUserSessions(
  orgId: string,
  userId: string,
  revokedBy: string,
  reason: string
): Promise<number> {
  await db
    .update(userSessions)
    .set({ isRevoked: true, revokedAt: new Date(), revokedBy, revokedReason: reason })
    .where(
      and(
        eq(userSessions.orgId, orgId),
        eq(userSessions.userId, userId),
        eq(userSessions.isRevoked, false)
      )
    );
  return 1;
}
