/**
 * Wave 1.1 — SSO HTTP routes.
 *
 * Four endpoints scoped under whatever prefix the caller mounts:
 *   GET  /:orgId/saml/login        302 → IdP entryPoint
 *   POST /:orgId/saml/acs          accepts SAML assertion, issues session
 *   GET  /:orgId/oidc/login        302 → IdP authorization endpoint
 *   GET  /:orgId/oidc/callback     completes Auth Code + PKCE, issues session
 *
 * Session issuance is delegated to the host app via the `sessionIssuer`
 * port so we do not duplicate or conflict with the existing
 * compliance/session-management surface. Likewise `configLookup` and
 * `secretResolver` are ports — this file knows nothing about Drizzle
 * or environment secret storage layout.
 *
 * OIDC PKCE state (verifier + nonce) is stashed in a short-lived
 * server-managed cookie. Cookie is httpOnly + SameSite=Lax + Secure
 * in production; expires after 10 minutes.
 */
import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import type { SsoConfig, SsoOidcConfig, SsoSamlConfig } from "../../shared/schema/sso";
import { validateSamlAssertion } from "./saml";
import { beginOidcAuthorization, completeOidcAuthorization } from "./oidc";

export type SsoSecretResolver = (ref: string) => Promise<string>;
export type SsoConfigLookup = (
  orgId: string,
  protocol: "saml" | "oidc"
) => Promise<SsoConfig | undefined>;

export interface SsoSessionIssuer {
  /**
   * Resolve or just-in-time provision a user given an IdP identity
   * and return a session token + redirect target. Returning `null`
   * rejects the assertion (user not allowed in this org).
   */
  issue(args: {
    orgId: string;
    protocol: "saml" | "oidc";
    subject: string;
    email?: string | undefined;
    displayName?: string | undefined;
    attributes: Record<string, unknown>;
    req: Request;
  }): Promise<{
    sessionToken: string;
    redirectTo: string;
    /**
     * Absolute session expiry (epoch ms). When provided, the session
     * cookie's `maxAge` is bound to it so the browser drops the cookie
     * in lock-step with the server-side session record. When omitted, a
     * bounded default TTL is applied (never an open-ended session cookie).
     */
    expiresAt?: number;
  } | null>;
}

/** Default session-cookie lifetime when the issuer does not supply one. */
const DEFAULT_SESSION_TTL_MS = (() => {
  const hours = Number(process.env["SSO_SESSION_TTL_HOURS"]);
  return Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
})();

export interface MountSsoOptions {
  configLookup: SsoConfigLookup;
  secretResolver: SsoSecretResolver;
  sessionIssuer: SsoSessionIssuer;
  sessionCookieName?: string; // defaults to "arus_session"
}

const PKCE_COOKIE = "arus_sso_pkce";

function setPkceCookie(res: Response, payload: object): void {
  const value = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  res.cookie(PKCE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
}

function readPkceCookie(req: Request): {
  state: string;
  codeVerifier: string;
  nonce: string;
  orgId: string;
} | null {
  const raw = (req as Request & { cookies?: Record<string, string> }).cookies?.[PKCE_COOKIE];
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (
      typeof parsed["state"] !== "string" ||
      typeof parsed["codeVerifier"] !== "string" ||
      typeof parsed["nonce"] !== "string" ||
      typeof parsed["orgId"] !== "string"
    ) {
      return null;
    }
    return {
      state: parsed["state"],
      codeVerifier: parsed["codeVerifier"],
      nonce: parsed["nonce"],
      orgId: parsed["orgId"],
    };
  } catch {
    return null;
  }
}

function clearPkceCookie(res: Response): void {
  res.clearCookie(PKCE_COOKIE, { path: "/" });
}

function buildSessionCookieOptions(expiresAt?: number): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  // SEC: always set a finite `maxAge`. Previously the session cookie had
  // no expiry/maxAge, making it an open-ended browser session cookie not
  // bound to the server session's lifetime. Prefer the issuer-supplied
  // absolute expiry; otherwise fall back to a bounded default TTL.
  const remaining = typeof expiresAt === "number" ? expiresAt - Date.now() : NaN;
  const maxAge = Number.isFinite(remaining) && remaining > 0 ? remaining : DEFAULT_SESSION_TTL_MS;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge,
  };
}

export function createSsoRouter(opts: MountSsoOptions): Router {
  const router = Router();
  const sessionCookie = opts.sessionCookieName || "arus_session";

  // SAML — kick off (IdP-initiated flows also supported via direct POST to /acs)
  router.get("/:orgId/saml/login", async (req, res) => {
    const cfg = await opts.configLookup(req.params.orgId, "saml");
    if (!cfg || !cfg.enabled) {
      return res.status(404).json({ error: "sso_not_configured" });
    }
    const saml = cfg.config as SsoSamlConfig;
    // RelayState carries our intended post-login target.
    const relayState = typeof req.query["next"] === "string" ? req.query["next"] : "/";
    const url = new URL(saml.entryPoint);
    url.searchParams.set("RelayState", relayState);
    return res.redirect(302, url.toString());
  });

  // SAML — assertion consumer service
  router.post("/:orgId/saml/acs", async (req, res) => {
    try {
      const cfg = await opts.configLookup(req.params.orgId, "saml");
      if (!cfg || !cfg.enabled) {
        return res.status(404).json({ error: "sso_not_configured" });
      }
      const body = req.body as { SAMLResponse?: string; RelayState?: string };
      if (!body?.SAMLResponse) {
        return res.status(400).json({ error: "missing_saml_response" });
      }

      const profile = await validateSamlAssertion(cfg.config as SsoSamlConfig, body.SAMLResponse);
      const issued = await opts.sessionIssuer.issue({
        orgId: req.params.orgId,
        protocol: "saml",
        subject: profile.nameId,
        email: profile.email,
        displayName: profile.displayName,
        attributes: profile.attributes,
        req,
      });
      if (!issued) {
        return res.status(403).json({ error: "user_not_provisioned" });
      }

      res.cookie(sessionCookie, issued.sessionToken, buildSessionCookieOptions(issued.expiresAt));
      const target = sanitizeRedirect(body.RelayState || issued.redirectTo);
      return res.redirect(302, target);
    } catch (err) {
      return res.status(401).json({
        error: "saml_assertion_invalid",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  // OIDC — kick off authorization code + PKCE
  router.get("/:orgId/oidc/login", async (req, res) => {
    try {
      const cfg = await opts.configLookup(req.params.orgId, "oidc");
      if (!cfg || !cfg.enabled) {
        return res.status(404).json({ error: "sso_not_configured" });
      }
      const oidc = cfg.config as SsoOidcConfig;
      const begin = await beginOidcAuthorization(oidc, opts.secretResolver);
      setPkceCookie(res, {
        state: begin.state,
        codeVerifier: begin.codeVerifier,
        nonce: begin.nonce,
        orgId: req.params.orgId,
      });
      return res.redirect(302, begin.url);
    } catch (err) {
      return res.status(500).json({
        error: "oidc_init_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  // OIDC — callback
  router.get("/:orgId/oidc/callback", async (req, res) => {
    try {
      const stash = readPkceCookie(req);
      if (!stash || stash.orgId !== req.params.orgId) {
        return res.status(400).json({ error: "pkce_state_missing" });
      }
      const cfg = await opts.configLookup(req.params.orgId, "oidc");
      if (!cfg || !cfg.enabled) {
        return res.status(404).json({ error: "sso_not_configured" });
      }

      // openid-client expects the FULL callback URL including query string.
      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
      const host = req.headers.host || "localhost";
      const callbackUrl = new URL(req.originalUrl, `${proto}://${host}`);

      const user = await completeOidcAuthorization(
        cfg.config as SsoOidcConfig,
        opts.secretResolver,
        {
          callbackUrl,
          codeVerifier: stash.codeVerifier,
          expectedState: stash.state,
          expectedNonce: stash.nonce,
        }
      );

      const issued = await opts.sessionIssuer.issue({
        orgId: req.params.orgId,
        protocol: "oidc",
        subject: user.sub,
        email: user.email,
        displayName: user.name,
        attributes: user.raw,
        req,
      });
      if (!issued) {
        clearPkceCookie(res);
        return res.status(403).json({ error: "user_not_provisioned" });
      }

      clearPkceCookie(res);
      res.cookie(sessionCookie, issued.sessionToken, buildSessionCookieOptions(issued.expiresAt));
      return res.redirect(302, sanitizeRedirect(issued.redirectTo));
    } catch (err) {
      clearPkceCookie(res);
      return res.status(401).json({
        error: "oidc_callback_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  return router;
}

export function mountSsoRoutes(parent: Router, prefix: string, opts: MountSsoOptions): void {
  parent.use(prefix, createSsoRouter(opts));
}

function sanitizeRedirect(target: string): string {
  // Only allow relative URLs to defeat open-redirect.
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) {
    return "/";
  }
  return target;
}

// Helper to mint a per-request CSRF-style nonce should callers want it.
export function newSsoNonce(): string {
  return randomBytes(16).toString("hex");
}
