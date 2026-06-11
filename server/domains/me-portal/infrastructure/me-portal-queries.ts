/**
 * Infrastructure: data access for the Me-Portal BFF service.
 *
 * Holds the raw `db` reads/writes (users, admin sessions, dashboard prefs,
 * crew link) so me-portal-service depends on this repository rather than the
 * database handle directly (hexagonal storage boundary). Queries are
 * unchanged — moved verbatim from the service. Validation/business logic stays
 * in the service.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  users,
  adminSessions,
  userDashboardPreferences,
  crew,
  pilotFeedback,
} from "@shared/schema-runtime";
import type { InsertPilotFeedback, PilotFeedback } from "@shared/schema";

export async function getMustChangePassword(
  orgId: string,
  userId: string
): Promise<{ mustChangePassword: boolean | null } | undefined> {
  const [record] = await db
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  return record;
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
}

export async function deleteUserSessionByToken(userId: string, tokenHash: string): Promise<void> {
  await db
    .delete(adminSessions)
    .where(and(eq(adminSessions.sessionToken, tokenHash), eq(adminSessions.userId, userId)));
}

export async function getDashboardPrefs(
  orgId: string,
  userId: string
): Promise<{ prefsJson: unknown } | undefined> {
  const [row] = await db
    .select({ prefsJson: userDashboardPreferences.prefsJson })
    .from(userDashboardPreferences)
    .where(
      and(eq(userDashboardPreferences.orgId, orgId), eq(userDashboardPreferences.userId, userId))
    )
    .limit(1);
  return row;
}

export async function upsertDashboardPrefs(
  orgId: string,
  userId: string,
  prefsJson: unknown
): Promise<void> {
  await db
    .insert(userDashboardPreferences)
    .values({ orgId, userId, prefsJson })
    .onConflictDoUpdate({
      target: [userDashboardPreferences.orgId, userDashboardPreferences.userId],
      set: { prefsJson, updatedAt: new Date() },
    });
}

export async function getCrewLinkId(
  orgId: string,
  userId: string
): Promise<{ id: string } | undefined> {
  const [crewMember] = await db
    .select({ id: crew.id })
    .from(crew)
    .where(and(eq(crew.orgId, orgId), eq(crew.userId, userId)))
    .limit(1);
  return crewMember;
}

/** Full user row matched case-insensitively by username within an org. */
export async function findUserByUsername(orgId: string, username: string) {
  const [record] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), sql`lower(${users.username}) = lower(${username})`))
    .limit(1);
  return record;
}

export async function touchUserLastLogin(orgId: string, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

/** Full user row by id within an org. */
export async function getUserById(orgId: string, userId: string) {
  const [record] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  return record;
}

export async function insertPilotFeedback(values: InsertPilotFeedback): Promise<PilotFeedback> {
  const [row] = await db.insert(pilotFeedback).values(values).returning();
  if (!row) {
    throw new Error("pilot_feedback insert returned no row");
  }
  return row;
}

/** Newest-first feedback submitted by this user (their "My reports" list). */
export async function listPilotFeedbackForUser(
  orgId: string,
  userId: string,
  limit = 50
): Promise<PilotFeedback[]> {
  return db
    .select()
    .from(pilotFeedback)
    .where(and(eq(pilotFeedback.orgId, orgId), eq(pilotFeedback.userId, userId)))
    .orderBy(desc(pilotFeedback.createdAt))
    .limit(limit);
}

export type PilotFeedbackWithSubmitter = PilotFeedback & { submitterName: string | null };

/**
 * Newest-first feedback across the whole org (office review queue).
 * Left-joins the submitter's display name — dev-login sessions reference
 * synthetic user ids with no users row, so the name may be null.
 */
export async function listPilotFeedbackForOrg(
  orgId: string,
  limit = 200
): Promise<PilotFeedbackWithSubmitter[]> {
  const rows = await db
    .select({ feedback: pilotFeedback, submitterName: users.name })
    .from(pilotFeedback)
    .leftJoin(users, and(eq(users.id, pilotFeedback.userId), eq(users.orgId, pilotFeedback.orgId)))
    .where(eq(pilotFeedback.orgId, orgId))
    .orderBy(desc(pilotFeedback.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.feedback, submitterName: r.submitterName ?? null }));
}

/** Apply an office review action; returns the updated row or undefined if absent. */
export async function updatePilotFeedbackReview(
  orgId: string,
  id: string,
  patch: {
    status: string;
    resolutionNote?: string | null;
    linkedWorkOrderId?: string | null;
  }
): Promise<PilotFeedback | undefined> {
  const [row] = await db
    .update(pilotFeedback)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(pilotFeedback.orgId, orgId), eq(pilotFeedback.id, id)))
    .returning();
  return row;
}

export async function updateUserPassword(
  orgId: string,
  userId: string,
  passwordHash: string
): Promise<void> {
  await db
    .update(users)
    .set({
      passwordHash,
      passwordUpdatedAt: new Date(),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}
