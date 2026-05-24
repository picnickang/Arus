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
  storage: { createComplianceBundle: (b: ComplianceBundle) => Promise<ComplianceBundle> }
): Promise<ComplianceBundle> {
  const reportsDir = join(process.cwd(), "compliance-reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${complianceBundle.title.replace(/\s+/g, "_")}_${timestamp}`;

  const htmlPath = join(reportsDir, `${filename}.html`);
  writeFileSync(htmlPath, "<!-- HTML content placeholder -->");

  const bundleData = {
    bundleId: complianceBundle.bundleId,
    title: complianceBundle.title,
    orgId: complianceBundle.orgId ?? null,
    kind: complianceBundle.kind,
    sha256Hash: complianceBundle.sha256Hash,
    description: complianceBundle.description || null,
    generatedAt: new Date(),
    filePath: htmlPath,
    metadata: (complianceBundle as Record<string, unknown>).metadata ?? null,
    createdAt: new Date(),
    fileFormat: complianceBundle.fileFormat || null,
    status: complianceBundle.status || null,
  } as object as ComplianceBundle;

  return storage.createComplianceBundle(bundleData);
}
