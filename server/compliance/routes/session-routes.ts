import { Router, Request, Response } from "express";
import { sessionManagementService } from "../session-management.service";
import { requireComplianceAccess } from "./audit-routes";
import { createLogger } from "../../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Compliance:Routes:SessionRoutes");

const router = Router();

router.get("/sessions", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.query.userId as string;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    const sessions = await sessionManagementService.getUserSessions(orgId, userId);
    return res.json({
      success: true,
      data: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        deviceFingerprint: s.deviceFingerprint,
        isRevoked: s.isRevoked,
        mfaVerified: s.mfaVerified,
      })),
    });
  } catch (error) {
    logger.error("[Compliance] Get sessions error:", undefined, error);
    return res.status(500).json({ error: "Failed to get sessions" });
  }
});

router.post("/sessions/validate", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { sessionToken } = req.body;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    if (!sessionToken) {
      return res.status(400).json({ error: "Session token required" });
    }
    const result = await sessionManagementService.validateSession(sessionToken, {
      updateActivity: false,
      orgId,
    });
    return res.json({
      success: true,
      valid: result.valid,
      expired: result.expired,
      revoked: result.revoked,
      inactivityTimeout: result.inactivityTimeout,
      error: result.error,
    });
  } catch (error) {
    logger.error("[Compliance] Validate session error:", undefined, error);
    return res.status(500).json({ error: "Failed to validate session" });
  }
});

router.post("/sessions/revoke", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const { sessionId, reason } = req.body;
    const adminId = (req.headers["x-admin-id"] as string) ?? "admin";
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }
    await sessionManagementService.revokeSession(sessionId, adminId, reason || "Admin revocation");
    return res.json({ success: true, message: "Session revoked successfully" });
  } catch (error) {
    logger.error("[Compliance] Revoke session error:", undefined, error);
    return res.status(500).json({ error: "Failed to revoke session" });
  }
});

router.post(
  "/sessions/revoke-all",
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { userId, reason } = req.body;
      const adminId = (req.headers["x-admin-id"] as string) ?? "admin";
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      await sessionManagementService.revokeAllUserSessions(
        orgId,
        userId,
        adminId,
        reason || "Admin bulk revocation"
      );
      return res.json({ success: true, message: "All sessions revoked for user" });
    } catch (error) {
      logger.error("[Compliance] Revoke all sessions error:", undefined, error);
      return res.status(500).json({ error: "Failed to revoke sessions" });
    }
  }
);

router.post("/sessions/cleanup", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const count = await sessionManagementService.cleanupExpiredSessions();
    return res.json({ success: true, message: `Cleaned up ${count} expired sessions`, count });
  } catch (error) {
    logger.error("[Compliance] Session cleanup error:", undefined, error);
    return res.status(500).json({ error: "Failed to clean up sessions" });
  }
});

router.get("/login-events", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const events = await sessionManagementService.getLoginEvents(orgId, {
      limit: Number.parseInt(req.query.limit as string) || 100,
      offset: Number.parseInt(req.query.offset as string) ?? 0,
    });
    return res.json({ success: true, data: events });
  } catch (error) {
    logger.error("[Compliance] Login events error:", undefined, error);
    return res.status(500).json({ error: "Failed to get login events" });
  }
});

router.post(
  "/sessions/suspicious",
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const { sessionId, flagType, metadata } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }
      await sessionManagementService.flagSuspiciousSession(
        sessionId,
        flagType || "manual_review",
        metadata
      );
      return res.json({ success: true, message: "Session flagged successfully" });
    } catch (error) {
      logger.error("[Compliance] Flag suspicious session error:", undefined, error);
      return res.status(500).json({ error: "Failed to flag session" });
    }
  }
);

export { router as complianceSessionRouter };
