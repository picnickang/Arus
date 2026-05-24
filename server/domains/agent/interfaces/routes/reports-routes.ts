import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { getReportArtifact } from "../../tools/enhanced-report-tools";

export function registerReportsRoutes(app: Express) {
  app.get("/api/agent/reports/:reportId/download", async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { reportId } = req.params;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(reportId)) {
        return res.status(400).json({ error: "Invalid report ID format" });
      }

      const artifact = getReportArtifact(reportId);
      if (!artifact) {
        return res.status(404).json({ error: "Report artifact not found" });
      }

      if (artifact.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(artifact.filePath)) {
        return res.status(404).json({ error: "Report file no longer available" });
      }

      const ext = path.extname(artifact.fileName).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".json": "application/json",
        ".csv": "text/csv",
        ".txt": "text/plain",
        ".pdf": "application/pdf",
      };
      res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
      const fileStream = fs.createReadStream(artifact.filePath);
      fileStream.pipe(res);
      return undefined;
    } catch (error: unknown) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Download failed" });
    }
  });
}
