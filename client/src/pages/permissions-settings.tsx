import { Redirect } from "wouter";

/**
 * Permissions management has been consolidated into Crew → Roles & Dashboards,
 * where each role now has full access-permission CRUD (the per-role permission
 * matrix). This standalone page redirects there so there is a single place to
 * manage role access.
 */
export default function PermissionsSettings() {
  return <Redirect to="/crew-management?view=roles" />;
}
