/**
 * Push B1 step 6 — Quota enforcement middleware.
 *
 * Wraps any route that produces tenant-bounded resource consumption.
 *   * Soft throttle at 80% used: request still succeeds, but the
 *     response carries `X-Tenant-Quota-Warning` so the UI can warn the
 *     operator before they hit the hard ceiling.
 *   * Hard throttle at 100%: 429 with `Retry-After`. For per-day
 *     metrics the header points at the next UTC midnight; for
 *     instantaneous metrics it's a small default so clients back off.
 *
 * The middleware does NOT increment usage. Increment happens in the
 * domain code after the resource is actually created, because
 * pessimistic pre-decrement would force a transactional dance the
 * domain code isn't built for.
 */

import type { Request, Response, NextFunction } from "express";
import { authenticatedRequest } from "./auth";
import { quotaService, type QuotaMetric } from "../tenancy/quota-service";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Middleware:TenantQuota");

export function enforceQuota(metric: QuotaMetric) {
  return async function quotaMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orgId = authenticatedRequest(req).orgId;
      if (!orgId) {
        // No tenant context (public endpoint or pre-auth) — skip.
        return next();
      }
      const check = await quotaService.check(orgId, metric);
      if (check.exceeded) {
        const retry = Math.max(1, check.retryAfterSeconds || 60);
        res.setHeader("Retry-After", String(retry));
        res.setHeader("X-Tenant-Quota-Exceeded", metric);
        res.status(429).json({
          error: "Tenant quota exceeded",
          code: "TENANT_QUOTA_EXCEEDED",
          metric: check.metric,
          limit: check.limit,
          used: check.used,
          retryAfterSeconds: retry,
        });
        return;
      }
      if (check.warning) {
        res.setHeader("X-Tenant-Quota-Warning", metric);
        res.setHeader(
          "X-Tenant-Quota-Ratio",
          check.ratio.toFixed(2)
        );
      }
      next();
    } catch (err) {
      // Never block a request because the quota subsystem itself broke.
      // The fail-closed boundary is RLS; quotas are commercial.
      logger.warn("Quota check failed; allowing request", {
        metric,
        error: err instanceof Error ? err.message : String(err),
      });
      next();
    }
  };
}
