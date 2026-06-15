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
import { userDashboardPrefsSchema, type UserDashboardPrefs } from "@shared/schema-runtime";
import {
  getMustChangePassword,
  deleteAllUserSessions,
  deleteUserSessionByToken,
  getDashboardPrefs,
  upsertDashboardPrefs,
  findUserByUsername,
  touchUserLastLogin,
  getUserById,
  updateUserPassword,
  insertPilotFeedback,
  listPilotFeedbackForUser,
  listPilotFeedbackForOrg,
  updatePilotFeedbackReview,
  type PilotFeedbackWithSubmitter,
} from "./infrastructure/me-portal-queries";
import type { PilotFeedback, PilotFeedbackDraft, PilotFeedbackReview } from "@shared/schema";
import { dbSystemAdminStorage, vesselService } from "../../repositories";
import { crewAdminService } from "../../services/crew-admin-facade";
import { safetyAlarmService, AlarmValidationError } from "../../services/safety-alarm-facade";
import {
  type RoleDashboardConfig,
  type TaskSourceKey,
  type VisibilityScope,
  ALARM_SEVERITY_RANK,
  mergeDashboardConfigs,
  applyUserDashboardPrefs,
  scopeForAlarms,
} from "@shared/role-dashboard";
import type { SafetyAlarmWithAcks, UserAlarmScope } from "../../services/safety-alarm-facade";
import type { VesselAssignmentEntity } from "../../services/crew-admin-facade";
import { buildMePortalTasks } from "./me-portal-task-feed";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const SESSION_HOURS = 8;

export class MePortalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
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

export interface MeAlarmView extends Omit<SafetyAlarmWithAcks, "acknowledgements"> {
  /** Whether the requesting user has already acknowledged this alarm. */
  acknowledged: boolean;
  /** Total acknowledgements recorded for this alarm. */
  acknowledgedCount: number;
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
  /** The caller's raw personal preferences (for the edit UI). */
  prefs: UserDashboardPrefs | null;
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

export class MePortalService {
  /**
   * Resolve a vessel-id scope for a SINGLE capability. `scope` is the
   * capability-specific visibility scope (null = the capability is not granted
   * by any role → restrict to the user's explicit vessel assignments only,
   * never fleet-wide). An explicit fleet-wide assignment (null vesselId) always
   * widens to the whole fleet because that is a deliberate admin grant.
   */
  private computeScope(
    assignments: VesselAssignmentEntity[],
    scope: VisibilityScope | null
  ): UserAlarmScope {
    const vesselIds = assignments
      .filter((a) => a.isActive && a.vesselId)
      .map((a) => a.vesselId as string);
    const fleetWide =
      scope === "fleet" || assignments.some((a) => a.isActive && a.vesselId === null);
    return { vesselIds, fleetWide };
  }

  /**
   * Server-side enforcement of the forced password-change policy. Every
   * non-credential `/api/me/*` data read must call this first so the gate
   * cannot be bypassed by a client that skips the change-password UX. Returns a
   * distinct `PASSWORD_CHANGE_REQUIRED` (403) the frontend can route on.
   */
  private async assertPasswordChangeNotRequired(user: MeUser): Promise<void> {
    const record = await getMustChangePassword(user.orgId, user.id);
    if (record?.mustChangePassword) {
      throw new MePortalError(
        "You must change your password before continuing",
        "PASSWORD_CHANGE_REQUIRED",
        403
      );
    }
  }

  /** Revoke every active session for a user (credential-rotation hardening). */
  private async invalidateUserSessions(userId: string): Promise<void> {
    await deleteAllUserSessions(userId);
  }

  /**
   * Sign the caller out by revoking ONLY the session backing the token they
   * presented — other devices/sessions for the same user stay alive. Scoped by
   * both token hash and userId so a token can never delete another user's row.
   * Idempotent: deleting an already-gone session is a no-op success, so a
   * double-click or a retry after the token expired still "logs out" cleanly.
   */
  async logout(user: MeUser, sessionToken: string): Promise<void> {
    const tokenHash = hashSessionToken(sessionToken);
    await deleteUserSessionByToken(user.id, tokenHash);
  }

  async getDashboard(user: MeUser): Promise<DashboardPayload> {
    await this.assertPasswordChangeNotRequired(user);
    const configs = await crewAdminService.resolveEffectiveConfigList(
      user.orgId,
      user.id,
      user.role
    );
    const roleConfig = mergeDashboardConfigs(configs);
    // Layer the caller's personal tweaks on top (intersect-only: hidden/order/
    // settings/landing). Never widens what the role grants.
    const prefs = await this.getPreferences(user);
    const config = applyUserDashboardPrefs(roleConfig, prefs);
    const assignments = await crewAdminService.getAssignments(user.orgId, user.id);
    // Dashboard vessel roster is reference context, scoped to the broadest scope
    // the user legitimately holds across any role.
    const scope = this.computeScope(assignments, config.visibilityScope);

    const allVessels = await vesselService.getVessels(user.orgId);
    const vesselList = allVessels.map((v: { id: string; name: string }) => ({
      id: v.id,
      name: v.name,
    }));
    const visibleVessels = scope.fleetWide
      ? vesselList
      : vesselList.filter((v) => scope.vesselIds.includes(v.id));

    const record = await getMustChangePassword(user.orgId, user.id);

    return {
      user,
      role: user.role,
      config,
      visibilityScope: config.visibilityScope,
      assignments,
      vessels: visibleVessels,
      fleetWide: scope.fleetWide,
      mustChangePassword: record?.mustChangePassword ?? false,
      prefs,
    };
  }

  /**
   * Read the caller's stored personal dashboard preferences (or null when they
   * have none yet). Org-scoped so a token can only ever read its own org's row.
   */
  async getPreferences(user: MeUser): Promise<UserDashboardPrefs | null> {
    await this.assertPasswordChangeNotRequired(user);
    const row = await getDashboardPrefs(user.orgId, user.id);
    if (!row) {
      return null;
    }
    const parsed = userDashboardPrefsSchema.safeParse(row.prefsJson);
    return parsed.success ? parsed.data : null;
  }

  /**
   * Upsert the caller's personal dashboard preferences. Validates against the
   * shared schema (unknown fields stripped) and stores only the personal tweak
   * layer — the role config is never mutated here.
   */
  async savePreferences(user: MeUser, prefs: unknown): Promise<UserDashboardPrefs> {
    await this.assertPasswordChangeNotRequired(user);
    const validated = userDashboardPrefsSchema.parse(prefs);
    await upsertDashboardPrefs(user.orgId, user.id, validated);
    return validated;
  }

  async getTasks(user: MeUser): Promise<TaskItem[]> {
    await this.assertPasswordChangeNotRequired(user);
    return buildMePortalTasks(user, (assignments, scope) => this.computeScope(assignments, scope));
  }

  async getVisibleAlarms(user: MeUser): Promise<MeAlarmView[]> {
    await this.assertPasswordChangeNotRequired(user);
    const scope = await this.resolveAlarmScope(user);
    const alarms = await safetyAlarmService.listActiveForUser(user.orgId, scope);
    return alarms
      .map((alarm) => this.toAlarmView(alarm, user.id))
      .sort(
        (a, b) =>
          (ALARM_SEVERITY_RANK[b.severity as keyof typeof ALARM_SEVERITY_RANK] ?? 0) -
          (ALARM_SEVERITY_RANK[a.severity as keyof typeof ALARM_SEVERITY_RANK] ?? 0)
      );
  }

  /**
   * Project a domain alarm into the user-portal view: strips the full ack roster
   * but derives the CURRENT user's acknowledged state (what the banner needs to
   * decide button visibility) plus an aggregate count.
   */
  private toAlarmView(alarm: SafetyAlarmWithAcks, userId: string): MeAlarmView {
    const { acknowledgements, ...rest } = alarm;
    return {
      ...rest,
      acknowledged: acknowledgements.some((ack) => ack.userId === userId),
      acknowledgedCount: acknowledgements.length,
    };
  }

  /**
   * Vessel scope for safety-alarm visibility/ack. Resolved ONLY from roles that
   * actually surface alarm data; a fleet scope held purely for an unrelated feed
   * (e.g. procurement) never widens alarm visibility. With no alarm-granting
   * role, the user still sees their explicitly assigned vessels' alarms.
   */
  private async resolveAlarmScope(user: MeUser): Promise<UserAlarmScope> {
    const configs = await crewAdminService.resolveEffectiveConfigList(
      user.orgId,
      user.id,
      user.role
    );
    const assignments = await crewAdminService.getAssignments(user.orgId, user.id);
    return this.computeScope(assignments, scopeForAlarms(configs));
  }

  async acknowledgeAlarm(
    user: MeUser,
    alarmId: string,
    comment: string | undefined
  ): Promise<void> {
    await this.assertPasswordChangeNotRequired(user);
    const scope = await this.resolveAlarmScope(user);
    try {
      await safetyAlarmService.acknowledge(
        {
          orgId: user.orgId,
          alarmId,
          userId: user.id,
          userName: user.name ?? user.email,
          source: "user_portal",
          comment,
        },
        scope
      );
    } catch (error) {
      if (error instanceof AlarmValidationError) {
        // Never reveal whether an out-of-scope alarm exists — treat OUT_OF_SCOPE
        // and NOT_FOUND alike as a 404 to the caller.
        throw new MePortalError("Alarm not found", "ALARM_NOT_FOUND", 404);
      }
      throw error;
    }
  }

  /* ------------------------------ Auth ----------------------------- */

  async login(
    orgId: string,
    username: string,
    password: string,
    context: { ip?: string | undefined; userAgent?: string | undefined }
  ): Promise<SessionResult> {
    const record = await findUserByUsername(orgId, username);

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

    await touchUserLastLogin(orgId, record.id);

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

  async changePassword(user: MeUser, currentPassword: string, newPassword: string): Promise<void> {
    const record = await getUserById(user.orgId, user.id);
    if (!record || !record.passwordHash) {
      throw new MePortalError("No password is set for this account", "NO_PASSWORD", 400);
    }
    const ok = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!ok) {
      throw new MePortalError("Current password is incorrect", "INVALID_CURRENT_PASSWORD", 401);
    }
    this.assertPasswordPolicy(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await updateUserPassword(user.orgId, user.id, passwordHash);
    // Rotate credentials => revoke every existing session so any pre-change
    // token (including the caller's current one) can no longer be used.
    await this.invalidateUserSessions(user.id);
  }

  /* --------------------------- Pilot feedback ----------------------- */

  /** Persist a crew feedback report; the server mints the tracking id. */
  async submitFeedback(user: MeUser, draft: PilotFeedbackDraft): Promise<PilotFeedback> {
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    const stamp = Date.now().toString(36).toUpperCase();
    return insertPilotFeedback({
      ...draft,
      orgId: user.orgId,
      userId: user.id,
      trackingId: `FB-${stamp}-${random}`,
    });
  }

  /** The caller's own reports, newest first ("My reports"). */
  async listMyFeedback(user: MeUser): Promise<PilotFeedback[]> {
    return listPilotFeedbackForUser(user.orgId, user.id);
  }

  /** Every report in the org, newest first (office review queue). */
  async listFeedbackForReview(user: MeUser): Promise<PilotFeedbackWithSubmitter[]> {
    return listPilotFeedbackForOrg(user.orgId);
  }

  /**
   * Office review action: acknowledge or resolve a report, optionally
   * attaching a resolution note and linking the work order raised from it.
   */
  async reviewFeedback(
    user: MeUser,
    feedbackId: string,
    review: PilotFeedbackReview
  ): Promise<PilotFeedback> {
    let row: PilotFeedback | undefined;
    try {
      row = await updatePilotFeedbackReview(user.orgId, feedbackId, review);
    } catch (error) {
      // FK violation (23503): linkedWorkOrderId doesn't reference a real
      // work order — surface as a client error, not a 500.
      if (error instanceof Error && "code" in error && error.code === "23503") {
        throw new MePortalError("Unknown work order id", "INVALID_WORK_ORDER", 400);
      }
      throw error;
    }
    if (!row) {
      throw new MePortalError("Feedback report not found", "FEEDBACK_NOT_FOUND", 404);
    }
    return row;
  }

  private assertPasswordPolicy(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new MePortalError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        "PASSWORD_TOO_SHORT",
        400
      );
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new MePortalError(
        `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
        "PASSWORD_TOO_LONG",
        400
      );
    }
    if (/[\r\n\0]/.test(password)) {
      throw new MePortalError("Password contains invalid characters", "INVALID_CHARACTERS", 400);
    }
  }
}

export const mePortalService = new MePortalService();
