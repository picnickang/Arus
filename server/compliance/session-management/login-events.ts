/**
 * Session Management - Login Events
 */

import { db } from "../../db";
import { loginEvents } from "@shared/schema-runtime";
import { eq, and, sql } from "drizzle-orm";
import type { LoginEvent } from "@shared/schema";
import type { LoginEventInput, SuspiciousActivityResult } from "./types.js";

export async function logLoginEvent(input: LoginEventInput): Promise<LoginEvent> {
  const id = crypto.randomUUID();
  const eventData = {
    id,
    orgId: input.orgId ?? null,
    userId: input.userId ?? null,
    attemptedEmail: input.attemptedEmail ?? null,
    loginType: input.loginType,
    outcome: input.outcome,
    failureReason: input.failureReason ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    geoLocation: input.geoLocation ?? null,
    deviceFingerprint: input.deviceFingerprint ?? null,
    suspiciousIndicators: input.suspiciousIndicators ?? null,
    riskScore: input.riskScore ?? null,
    sessionId: input.sessionId ?? null,
    createdAt: new Date(),
  };

  await db.insert(loginEvents).values(eventData as any);
  return eventData as LoginEvent;
}

export async function getLoginEvents(
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
  const conditions = [eq(loginEvents.orgId, orgId)];
  if (options?.userId) {
    conditions.push(eq(loginEvents.userId, options.userId));
  }
  if (options?.outcome) {
    conditions.push(eq(loginEvents.outcome, options.outcome));
  }

  return db
    .select()
    .from(loginEvents)
    .where(and(...conditions))
    .orderBy(sql`${loginEvents.createdAt} DESC`)
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);
}

export async function detectSuspiciousActivity(
  ipAddress: string,
  minutes: number = 15
): Promise<SuspiciousActivityResult> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const recentEvents = await db
    .select()
    .from(loginEvents)
    .where(and(eq(loginEvents.ipAddress, ipAddress), sql`${loginEvents.createdAt} > ${cutoff}`));

  const failedAttempts = recentEvents.filter((e) => e.outcome === "failure").length;
  const uniqueIps = new Set(recentEvents.map((e) => e.ipAddress)).size;
  const indicators: string[] = [];

  if (failedAttempts >= 5) {
    indicators.push("rapid_attempts");
  }
  if (uniqueIps >= 3) {
    indicators.push("multiple_ips");
  }

  return { failedAttempts, uniqueIps, suspicious: indicators.length > 0, indicators };
}
