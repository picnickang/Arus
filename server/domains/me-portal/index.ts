/**
 * Me Portal Domain (cloud-only BFF)
 *
 * User-facing aggregation for the role-aware User page plus regular-user
 * login and self password change.
 */

export * from "./application/me-portal-service";
export { registerMePortalRoutes } from "./interfaces/routes";
