/**
 * Session Management - Session Queries
 */

import { db } from '../../db';
import { userSessions } from '@shared/schema-runtime';
import { eq, and, lt, sql } from 'drizzle-orm';
import type { UserSession } from '@shared/schema';

export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();
  const expiredSessions = await db.select({ id: userSessions.id }).from(userSessions).where(and(lt(userSessions.expiresAt, now), eq(userSessions.isRevoked, false)));

  await db.update(userSessions).set({ isRevoked: true, revokedAt: now, revokedBy: 'system', revokedReason: 'Session expired' }).where(and(lt(userSessions.expiresAt, now), eq(userSessions.isRevoked, false)));

  return expiredSessions.length;
}

export async function getUserSessions(orgId: string, userId: string): Promise<UserSession[]> {
  return db.select().from(userSessions).where(and(eq(userSessions.orgId, orgId), eq(userSessions.userId, userId), eq(userSessions.isRevoked, false))).orderBy(sql`${userSessions.lastActivityAt} DESC`);
}

export async function getSessionByRefreshToken(refreshTokenHash: string) {
  const sessions = await db.select().from(userSessions).where(eq(userSessions.refreshToken, refreshTokenHash)).limit(1);
  return sessions[0];
}
