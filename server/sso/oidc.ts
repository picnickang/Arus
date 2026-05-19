/**
 * Wave 1.1 — OpenID Connect (Authorization Code + PKCE).
 *
 * openid-client v6 replaced the class-based `Issuer`/`Client` API with
 * a functional one. We isolate that API behind two small async
 * helpers so the rest of the SSO surface (and tests) need not track
 * upstream churn.
 *
 * Client secrets are NOT stored in `ssoConfigs.config` directly —
 * `clientSecretRef` resolves via `resolveSecret` which delegates to
 * the existing environment-secrets / crypto-service layer.
 */
import type { SsoOidcConfig } from "../../shared/schema/sso";

export interface OidcAuthorizationStart {
  url: string;
  state: string;
  codeVerifier: string;
  nonce: string;
}

export interface OidcUserSummary {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  raw: Record<string, unknown>;
}

type SecretResolver = (ref: string) => Promise<string>;

async function loadConfig(cfg: SsoOidcConfig, secretResolver: SecretResolver) {
  const oidc = await import("openid-client");
  const clientSecret = await secretResolver(cfg.clientSecretRef);
  // v6 discovery: openid-client `discovery(url, clientId, clientSecret?)`
  const config = await (oidc as any).discovery(
    new URL(cfg.discoveryUrl),
    cfg.clientId,
    clientSecret,
  );
  return { oidc: oidc as any, config };
}

export async function beginOidcAuthorization(
  cfg: SsoOidcConfig,
  secretResolver: SecretResolver,
): Promise<OidcAuthorizationStart> {
  const { oidc, config } = await loadConfig(cfg, secretResolver);
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const params = {
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  } as Record<string, string>;
  const url: URL = oidc.buildAuthorizationUrl(config, params);
  return { url: url.href, state, codeVerifier, nonce };
}

export async function completeOidcAuthorization(
  cfg: SsoOidcConfig,
  secretResolver: SecretResolver,
  args: { callbackUrl: URL; codeVerifier: string; expectedState: string; expectedNonce: string },
): Promise<OidcUserSummary> {
  const { oidc, config } = await loadConfig(cfg, secretResolver);
  const tokens = await oidc.authorizationCodeGrant(config, args.callbackUrl, {
    pkceCodeVerifier: args.codeVerifier,
    expectedState: args.expectedState,
    expectedNonce: args.expectedNonce,
  });
  const claims: Record<string, unknown> =
    typeof tokens.claims === "function" ? tokens.claims() : tokens.claims || {};
  const sub = String(claims.sub || "");
  if (!sub) throw new Error("OIDC ID token missing sub");
  return {
    sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    emailVerified: typeof claims.email_verified === "boolean" ? claims.email_verified : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    raw: claims,
  };
}
