/**
 * Navigation domain types.
 *
 * Pure type definitions used by the navigation policy layer. No React,
 * no I/O, no side effects. The hexagonal boundary: anything in this
 * file may be imported by application / infrastructure / interfaces
 * (React components), but this file itself depends on nothing inside
 * the client outside `@/config/roles` (the role enum).
 */

export type PortalKind = "admin" | "user";

/**
 * The set of role identifiers the navigation policy reasons about.
 * Matches the keys in `client/src/config/roles.ts` plus a sentinel
 * "default" used when no role is selected.
 *
 * Kept as a string union (rather than re-imported) so the domain layer
 * has no run-time coupling to the role config module — only nominal.
 */
export type NavRoleId =
  | "chief_engineer"
  | "deck_officer"
  | "fleet_manager"
  | "system_admin"
  | "captain"
  | "company_admin"
  | "viewer"
  | "default";
