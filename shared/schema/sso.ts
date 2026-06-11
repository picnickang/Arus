/**
 * Wave 1.1 — SSO (SAML 2.0 + OIDC) per-tenant configuration.
 *
 * One row per tenant per protocol. `config` holds protocol-specific
 * settings (entryPoint, cert, issuer for SAML; discovery URL +
 * clientId/secret for OIDC). Secrets live encrypted under the
 * existing crypto-service envelope; this table only stores the
 * envelope.
 */
import { pgTable, text, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./core";

export const ssoConfigs = pgTable(
  "sso_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    protocol: text("protocol").notNull(), // 'saml' | 'oidc'
    displayName: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    config: jsonb("config").notNull(),
    defaultRole: text("default_role"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    orgProtoIdx: uniqueIndex("sso_configs_org_protocol_idx").on(t.orgId, t.protocol),
  })
);

export const ssoSamlConfigSchema = z.object({
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().min(1),
  callbackUrl: z.string().url(),
  identifierFormat: z.string().optional(),
  signatureAlgorithm: z.enum(["sha256", "sha512"]).optional(),
});

export const ssoOidcConfigSchema = z.object({
  discoveryUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecretRef: z.string().min(1), // reference into secret store
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default(["openid", "email", "profile"]),
});

export const insertSsoConfigSchema = createInsertSchema(ssoConfigs).omit({
  createdAt: true,
  updatedAt: true,
});

export type SsoConfig = typeof ssoConfigs.$inferSelect;
export type InsertSsoConfig = z.infer<typeof insertSsoConfigSchema>;
export type SsoSamlConfig = z.infer<typeof ssoSamlConfigSchema>;
export type SsoOidcConfig = z.infer<typeof ssoOidcConfigSchema>;
