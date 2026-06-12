import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  index,
  createInsertSchema,
  z,
} from "../base";
import { organizations, users } from "../core";
import { vessels } from "../vessels";
import { equipment } from "../equipment";

// ============================================================================
// CONTEXT EVENTS
// ============================================================================

export const contextEvents = pgTable(
  "context_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    type: varchar("type", { length: 50 }).notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    duration: integer("duration"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    severity: varchar("severity", { length: 20 }),
    metadata: jsonb("metadata"),
    createdBy: varchar("created_by", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("idx_context_events_org").on(table.orgId),
    vesselIdx: index("idx_context_events_vessel").on(table.vesselId),
    equipmentIdx: index("idx_context_events_equipment").on(table.equipmentId),
    timestampIdx: index("idx_context_events_timestamp").on(table.timestamp),
    typeIdx: index("idx_context_events_type").on(table.type),
  })
);

export const insertContextEventSchema = createInsertSchema(contextEvents).omit({
  id: true,
  createdAt: true,
});

export type ContextEvent = typeof contextEvents.$inferSelect;
export type InsertContextEvent = z.infer<typeof insertContextEventSchema>;

// ============================================================================
// USER SESSIONS
// ============================================================================

export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    refreshToken: varchar("refresh_token", { length: 255 }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" }).defaultNow(),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    geoLocation: jsonb("geo_location"),
    isRevoked: boolean("is_revoked").default(false),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    revokedBy: varchar("revoked_by"),
    revokedReason: text("revoked_reason"),
    mfaVerified: boolean("mfa_verified").default(false),
    mfaVerifiedAt: timestamp("mfa_verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    sessionTokenIdx: index("idx_user_sessions_token").on(table.sessionToken),
    userIdIdx: index("idx_user_sessions_user_id").on(table.userId),
    expiresAtIdx: index("idx_user_sessions_expires").on(table.expiresAt),
    orgIdIdx: index("idx_user_sessions_org_id").on(table.orgId),
    isRevokedIdx: index("idx_user_sessions_revoked").on(table.isRevoked),
  })
);

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// ============================================================================
// LOGIN EVENTS
// ============================================================================

export const loginEvents = pgTable(
  "login_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").references(() => organizations.id),
    userId: varchar("user_id").references(() => users.id),
    attemptedEmail: varchar("attempted_email", { length: 255 }),
    loginType: text("login_type").notNull(),
    outcome: text("outcome").notNull(),
    failureReason: text("failure_reason"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    geoLocation: jsonb("geo_location"),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    suspiciousIndicators: text("suspicious_indicators").array(),
    riskScore: real("risk_score"),
    sessionId: varchar("session_id").references(() => userSessions.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_login_events_org_id").on(table.orgId),
    userIdIdx: index("idx_login_events_user_id").on(table.userId),
    outcomeIdx: index("idx_login_events_outcome").on(table.outcome),
    createdAtIdx: index("idx_login_events_created_at").on(table.createdAt),
    ipAddressIdx: index("idx_login_events_ip").on(table.ipAddress),
  })
);

export const insertLoginEventSchema = createInsertSchema(loginEvents).omit({
  id: true,
  createdAt: true,
});

export type LoginEvent = typeof loginEvents.$inferSelect;
export type InsertLoginEvent = z.infer<typeof insertLoginEventSchema>;
