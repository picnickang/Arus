/**
 * Push B1 (Multi-tenancy with Postgres RLS):
 * - `req.orgId` is derived from the authenticated user's claim when
 *   `REQUIRE_TENANT_AUTH=true`. In legacy single-tenant mode it falls
 *   back to `DEFAULT_ORG_ID`.
 * - `req.user.orgId` carries the source-of-truth tenant id read from
 *   the session token.
 */
declare global {
  namespace Express {
    interface Request {
      orgId: string;
      user?: {
        id: string;
        email: string;
        role: string;
        name?: string;
        isActive: boolean;
        orgId?: string;
      };
    }
  }
}

export {};
