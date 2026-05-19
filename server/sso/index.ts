/**
 * Wave 1.1 — SSO surface index.
 *
 * Exports the SAML + OIDC primitives, schema types, and a thin Express
 * router. The router is NOT auto-mounted in bootstrap; composition
 * roots opt in via `mountSsoRoutes(app, { secretResolver, sessionIssuer })`
 * so default deployments without SSO configured pay zero cost and
 * surface no public routes.
 */
export { validateSamlAssertion } from "./saml";
export { beginOidcAuthorization, completeOidcAuthorization } from "./oidc";
export type { SamlProfileSummary } from "./saml";
export type { OidcAuthorizationStart, OidcUserSummary } from "./oidc";
export { mountSsoRoutes, createSsoRouter } from "./routes";
export type { SsoSessionIssuer, SsoSecretResolver, SsoConfigLookup } from "./routes";
