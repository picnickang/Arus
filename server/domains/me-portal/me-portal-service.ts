/**
 * Me Portal Service (Backend-for-Frontend)
 *
 * User-facing aggregation for the role-aware User page: resolves the caller's
 * effective dashboard config, vessel assignments, personal task feed, and
 * visible safety alarms; also handles regular-user login + self password
 * change. Composes the crew-admin and safety-alarms domain services.
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../../db";
import { users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import {
  dbSystemAdminStorage,
  vesselService,
  workOrderService,
} from "../../repositories";
import { crewAdminService } from "../crew-admin/service";
import { safetyAlarmService } from "../safety-alarms/service";
import {
  type RoleDashboardConfig,
  type TaskSourceKey,
  type VisibilityScope,
  ALARM_SEVERITY_RANK,
} from "@shared/role-dashboard";
import type {
  SafetyAlarmWithAcks,
  UserAlarmScope,
} from "../safety-alarms/domain/types";
import type { VesselAssignmentEntity } from "../crew-admin/domain/types";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const SESSION_HOURS = 8;

export class MePortalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MePortalError";
  }
}

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  orgId: string;
}

export interface TaskItem {
  id: string;
  source: TaskSourceKey;
  title: string;
  status: string | null;
  priority: string | null;
  vesselId: string | null;
  link: string;
}

export interface DashboardPayload {
  user: MeUser;
  role: string;
  config: RoleDashboardConfig;
  visibilityScope: VisibilityScope;
  assignments: VesselAssignmentEntity[];
  vessels: Array<{ id: string; name: string }>;
  fleetWide: boolean;
  mustChangePassword: boolean;
}

interface SessionResult {
  sessionToken: string;
  expiresAt: Date;
  expiresIn: number;
  mustChangePassword: boolean;
  user: MeUser;
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export class MePortalService {
  async getScope(orgId: string, userId: string, config: RoleDashboardConfig): Promise<UserAlarmScope> {
    const assignments = await crewAdminService.getAssignments(orgId, userId);
    const vesselIds = assignments
      .filter((a) => a.isActive && a.vesselId)
      .map((a) => a.vesselId as string);
    const fleetWide =
      config.visibilityScope === "fleet" ||
      assignments.some((a) => a.isActive && a.vesselId === null);
    return { vesselIds, fleetWide };
  }

  async getDashboard(user: MeUser): Promise<DashboardPayload> {
    const config = await crewAdminService.resolveConfigByRoleName(user.orgId, user.role);
    const assignments = await crewAdminService.getAssignments(user.orgId, user.id);
    const scope = await this.getScope(user.orgId, user.id, config);

    const allVessels = await vesselService.getVessels(user.orgId);
    const vesselList = allVessels.map((v: { id: string; name: string }) => ({
      id: v.id,
      name: v.name,
    }));
    const visibleVessels = scope.fleetWide
      ? vesselList
      : vesselList.filter((v) => scope.vesselIds.includes(v.id));

    const [record] = await db
      .select({ mustChangePassword: users.mustChangePassword })
      .from(users)
      .where(and(eq(users.orgId, user.orgId), eq(users.id, user.id)))
      .limit(1);

    return {
      user,
      role: user.role,
      config,
      visibilityScope: config.visibilityScope,
      assignments,
      vessels: visibleVessels,
      fleetWide: scope.fleetWide,
      mustChangePassword: record?.mustChangePassword ?? false,
    };
  }

  async getTasks(user: MeUser): Promise<TaskItem[]> {
    const config = await crewAdminService.resolveConfigByRoleName(user.orgId, user.role);
    const scope = await this.getScope(user.orgId, user.id, config);
    const sources = new Set<TaskSourceKey>(config.taskSources);
    const items: TaskItem[] = [];

    if (sources.has("work_orders")) {
      const workOrders = (await workOrderService.getWorkOrdersWithDetails(
        undefined,
        user.orgId,
      )) as unknown[];
      for (const raw of workOrders) {
        if (typeof raw !== "object" || raw === null) continue;
        const wo = raw as Record<string, unknown>;
        const vesselId = asString(wo['vesselId']);
        if (!scope.fleetWide && vesselId && !scope.vesselIds.includes(vesselId)) {
          continue;
        }
        const id = asString(wo['id']);
        if (!id) continue;
        items.push({
          id,
          source: "work_orders",
          title: asString(wo['title']) ?? asString(wo['description']) ?? "Work order",
          status: asString(wo['status']),
          priority: asString(wo['priority']),
          vesselId,
          link: `/work-orders?id=${id}`,
        });
      }
    }

    return items;
  }

  async getVisibleAlarms(user: MeUser): Promise<SafetyAlarmWithAcks[]> {
    const config = await crewAdminService.resolveConfigByRoleName(user.orgId, user.role);
    const scope = await this.getScope(user.orgId, user.id, config);
    const alarms = await safetyAlarmService.listActiveForUser(user.orgId, scope);
    return alarms.sort(
      (a, b) =>
        (ALARM_SEVERITY_RANK[b.severity as keyof typeof ALARM_SEVERITY_RANK] ?? 0) -
        (ALARM_SEVERITY_RANK[a.severity as keyof typeof ALARM_SEVERITY_RANK] ?? 0),
    );
  }

  async acknowledgeAlarm(
    user: MeUser,
    alarmId: string,
    comment: string | undefined,
  ): Promise<void> {
    await safetyAlarmService.acknowledge({
      orgId: user.orgId,
      alarmId,
      userId: user.id,
      userName: user.name ?? user.email,
      source: "user_portal",
      comment,
    });
  }

  /* ------------------------------ Auth ----------------------------- */

  async login(
    orgId: string,
    username: string,
    password: string,
    context: { ip?: string; userAgent?: string },
  ): Promise<SessionResult> {
    const [record] = await db
      .select()
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.username, username)))
      .limit(1);

    const invalid = new MePortalError("Invalid username or password", "INVALID_CREDENTIALS", 401);

    if (!record || !record.passwordHash) {
      // Run a dummy compare to keep timing roughly constant.
      await bcrypt.compare(password, "$2a$12$0000000000000000000000000000000000000000000000000000");
      throw invalid;
    }
    const ok = await bcrypt.compare(password, record.passwordHash);
    if (!ok) {
      throw invalid;
    }
    if (record.isActive === false) {
      throw new MePortalError("This account is disabled", "ACCOUNT_DISABLED", 403);
    }
    if (!record.loginEnabled) {
      throw new MePortalError("Login is not enabled for this account", "LOGIN_DISABLED", 403);
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_HOURS);

    await dbSystemAdminStorage.createAdminSession({
      orgId,
      sessionToken: hashSessionToken(sessionToken),
      userId: record.id,
      adminEmail: record.email,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      expiresAt,
      lastActivityAt: new Date(),
    });

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(and(eq(users.orgId, orgId), eq(users.id, record.id)));

    return {
      sessionToken,
      expiresAt,
      expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      mustChangePassword: record.mustChangePassword,
      user: {
        id: record.id,
        email: record.email,
        name: record.name ?? null,
        role: record.role,
        orgId: record.orgId,
      },
    };
  }

  async changePassword(
    user: MeUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const [record] = await db
      .select()
      .from(users)
      .where(and(eq(users.orgId, user.orgId), eq(users.id, user.id)))
      .limit(1);
    if (!record || !record.passwordHash) {
      throw new MePortalError("No password is set for this account", "NO_PASSWORD", 400);
    }
    const ok = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!ok) {
      throw new MePortalError("Current password is incorrect", "INVALID_CURRENT_PASSWORD", 401);
    }
    this.assertPasswordPolicy(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await db
      .update(users)
      .set({
        passwordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(and(eq(users.orgId, user.orgId), eq(users.id, user.id)));
  }

  private assertPasswordPolicy(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new MePortalError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        "PASSWORD_TOO_SHORT",
        400,
      );
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new MePortalError(
        `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
        "PASSWORD_TOO_LONG",
        400,
      );
    }
    if (/[\r\n\0]/.test(password)) {
      throw new MePortalError("Password contains invalid characters", "INVALID_CHARACTERS", 400);
    }
  }
}

export const mePortalService = new MePortalService();
