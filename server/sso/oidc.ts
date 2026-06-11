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

/**
 * P2 #21 — OIDC discovery and token-exchange go over the network via
 * `openid-client`. Its v6 functional API does not expose an
 * AbortSignal hook, so we race each call against a wall-clock
 * deadline to ensure a stalled IdP cannot pin a request handler open
 * indefinitely (the SSO routes inherit the express request limits but
 * a leaked socket on the IdP side is not bounded by them).
 */
const OIDC_NETWORK_TIMEOUT_MS = 15_000;
async function withTimeout<T>(op: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`OIDC ${label} timed out after ${OIDC_NETWORK_TIMEOUT_MS}ms`)),
      OIDC_NETWORK_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([op, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function loadConfig(cfg: SsoOidcConfig, secretResolver: SecretResolver) {
  const oidc = await import("openid-client");
  const clientSecret = await secretResolver(cfg.clientSecretRef);
  // v6 discovery: openid-client `discovery(url, clientId, clientSecret?)`
  const oidcMod = oidc as object as typeof oidc & {
    discovery: (
      url: URL,
      clientId: string,
      clientSecret?: string
    ) => Promise<import("openid-client").Configuration>;
  };
  const config = await withTimeout(
    oidcMod.discovery(new URL(cfg.discoveryUrl), cfg.clientId, clientSecret),
    "discovery"
  );
  return { oidc: oidcMod, config };
}

export async function beginOidcAuthorization(
  cfg: SsoOidcConfig,
  secretResolver: SecretResolver
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
  args: { callbackUrl: URL; codeVerifier: string; expectedState: string; expectedNonce: string }
): Promise<OidcUserSummary> {
  const { oidc, config } = await loadConfig(cfg, secretResolver);
  const tokens = await withTimeout(
    oidc.authorizationCodeGrant(config, args.callbackUrl, {
      pkceCodeVerifier: args.codeVerifier,
      expectedState: args.expectedState,
      expectedNonce: args.expectedNonce,
    }),
    "authorizationCodeGrant"
  );
  const rawClaims = typeof tokens.claims === "function" ? tokens.claims() : tokens.claims;
  const claims: Record<string, unknown> = (rawClaims || {}) as object as Record<string, unknown>;
  const sub = String(claims["sub"] || "");
  if (!sub) {
    throw new Error("OIDC ID token missing sub");
  }
  return {
    sub,
    // Normalized at the IdP boundary: providers return claims with
    // arbitrary casing, lookups are lower()-based (0047).
    ...(typeof claims["email"] === "string" && { email: claims["email"].toLowerCase() }),
    ...(typeof claims["email_verified"] === "boolean" && {
      emailVerified: claims["email_verified"],
    }),
    ...(typeof claims["name"] === "string" && { name: claims["name"] }),
    raw: claims,
  };
}
