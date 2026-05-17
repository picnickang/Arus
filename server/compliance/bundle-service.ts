/**
 * Compliance Bundle Service - Handles saving and managing compliance bundles
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ComplianceBundle, InsertComplianceBundle } from "@shared/schema";

/**
 * Save compliance bundle to storage
 */
export async function saveComplianceBundle(
  complianceBundle: InsertComplianceBundle,
  storage: any
): Promise<ComplianceBundle> {
  const reportsDir = join(process.cwd(), "compliance-reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${complianceBundle.title.replace(/\s+/g, "_")}_${timestamp}`;

  const htmlPath = join(reportsDir, `${filename}.html`);
  writeFileSync(htmlPath, "<!-- HTML content placeholder -->");

  const bundleData: ComplianceBundle = {
    bundleId: complianceBundle.bundleId,
    title: complianceBundle.title,
    // @ts-ignore -- bulk-silence
    orgId: complianceBundle.orgId,
    kind: complianceBundle.kind,
    sha256Hash: complianceBundle.sha256Hash,
    description: complianceBundle.description || null,
    generatedAt: new Date(),
    filePath: htmlPath,
    // @ts-ignore -- bulk-silence
    metadata: complianceBundle.metadata || null,
    createdAt: new Date(),
    fileFormat: complianceBundle.fileFormat || null,
    status: complianceBundle.status || null,
  };

  return storage.createComplianceBundle(bundleData);
}
