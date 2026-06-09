import crypto from "crypto";
import { z } from "zod";
import type { DevLoginRequest, DevLoginResponse } from "@shared/dev-login";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { DEV_BYPASS_USER_ID } from "../dev-auth";
import { isDevLoginEnabled } from "./config";
import { DEV_USER_ROLES, devUserRoleLabel, isDevUserRole, type DevUserRole } from "./roles";

const DEV_LOGIN_TTL_MS = 8 * 60 * 60 * 1000;
const DEV_USER_ID_PREFIX = "dev-login-user-";

export const devLoginRequestSchema = z.discriminatedUnion("persona", [
  z.object({ persona: z.literal("admin") }),
  z.object({
    persona: z.literal("user"),
    role: z.enum(DEV_USER_ROLES).default("deck_officer"),
  }),
]);

export interface DevLoginSession {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: "super_admin" | DevUserRole;
  persona: DevLoginRequest["persona"];
  expiresAt: Date;
}

interface StoredDevLoginSession extends DevLoginSession {
  tokenHash: string;
  createdAt: Date;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export type DevLoginResult = DevLoginResponse & { expiresAt: Date };

const sessions = new Map<string, StoredDevLoginSession>();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function purgeExpiredSessions(now: number = Date.now()): void {
  for (const [tokenHash, session] of sessions) {
    if (session.expiresAt.getTime() <= now) {
      sessions.delete(tokenHash);
    }
  }
}

function devUserIdForRole(role: DevUserRole): string {
  return `${DEV_USER_ID_PREFIX}${role}`;
}

export function getDevLoginUserRole(userId: string | null | undefined): DevUserRole | null {
  if (!userId?.startsWith(DEV_USER_ID_PREFIX)) {
    return null;
  }
  const role = userId.slice(DEV_USER_ID_PREFIX.length);
  return isDevUserRole(role) ? role : null;
}

export function createDevLoginSession(
  request: DevLoginRequest,
  context: { ip?: string | undefined; userAgent?: string | undefined } = {}
): DevLoginResult {
  if (!isDevLoginEnabled()) {
    throw new Error("Dev login is disabled");
  }

  purgeExpiredSessions();

  const sessionToken = `dev_${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + DEV_LOGIN_TTL_MS);
  const user =
    request.persona === "admin"
      ? {
          id: DEV_BYPASS_USER_ID,
          email: "dev-admin@arus.local",
          name: "Development Superuser",
          role: "super_admin" as const,
          orgId: DEFAULT_ORG_ID,
        }
      : {
          id: devUserIdForRole(request.role),
          email: `dev-${request.role}@arus.local`,
          name: `Dev ${devUserRoleLabel(request.role)}`,
          role: request.role,
          orgId: DEFAULT_ORG_ID,
        };

  const tokenHash = hashToken(sessionToken);
  sessions.set(tokenHash, {
    ...user,
    persona: request.persona,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    ip: context.ip,
    userAgent: context.userAgent,
  });

  return {
    sessionToken,
    expiresAt,
    expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    mustChangePassword: false,
    user,
  };
}

export function resolveDevLoginSessionToken(token: string): DevLoginSession | null {
  if (!isDevLoginEnabled()) {
    return null;
  }
  purgeExpiredSessions();
  const session = sessions.get(hashToken(token));
  if (!session) {
    return null;
  }
  return {
    id: session.id,
    orgId: session.orgId,
    email: session.email,
    name: session.name,
    role: session.role,
    persona: session.persona,
    expiresAt: session.expiresAt,
  };
}

export function revokeDevLoginSessionToken(token: string): boolean {
  return sessions.delete(hashToken(token));
}
