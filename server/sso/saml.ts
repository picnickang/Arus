/**
 * Wave 1.1 — SAML 2.0 assertion handling.
 *
 * Thin wrapper over @node-saml/passport-saml's underlying SAML class
 * so we can validate IdP assertions without depending on Passport's
 * Express session contract (which conflicts with our existing
 * compliance/session-management surface).
 *
 * The Strategy is constructed per-request from the tenant's stored
 * config so a single process serves many tenants. Strategy instances
 * are cheap and stateless once built — we do NOT cache them, to keep
 * cert rotation immediate.
 */
import type { SsoSamlConfig } from "../../shared/schema/sso";

export interface SamlProfileSummary {
  nameId: string;
  email?: string;
  displayName?: string;
  attributes: Record<string, unknown>;
}

export async function validateSamlAssertion(
  cfg: SsoSamlConfig,
  samlResponseBase64: string,
): Promise<SamlProfileSummary> {
  // Lazy import — keeps cold start free for tenants that don't use SAML.
  const mod = await import("@node-saml/passport-saml");
  const SAML = (mod as unknown as { SAML: new (opts: Record<string, unknown>) => unknown }).SAML;

  const saml = new SAML({
    entryPoint: cfg.entryPoint,
    issuer: cfg.issuer,
    cert: cfg.cert,
    callbackUrl: cfg.callbackUrl,
    identifierFormat:
      cfg.identifierFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    signatureAlgorithm: cfg.signatureAlgorithm || "sha256",
    audience: cfg.issuer,
    wantAssertionsSigned: true,
  }) as {
    validatePostResponseAsync: (body: {
      SAMLResponse: string;
    }) => Promise<{ profile: Record<string, unknown> | null }>;
  };

  const { profile } = await saml.validatePostResponseAsync({
    SAMLResponse: samlResponseBase64,
  });
  if (!profile) throw new Error("SAML assertion returned no profile");

  const p = profile as Record<string, unknown>;
  const nameId = String(p.nameID || p["nameID"] || "");
  if (!nameId) throw new Error("SAML profile missing nameID");

  return {
    nameId,
    email: typeof p.email === "string" ? p.email : (p.nameID as string | undefined),
    displayName:
      (p.displayName as string | undefined) ||
      (p.cn as string | undefined) ||
      (p.givenName as string | undefined),
    attributes: p,
  };
}
