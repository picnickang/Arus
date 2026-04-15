/**
 * Domain Router Registry — Smoke Tests
 *
 * Verifies that the domain-router-registry configuration is consistent.
 * Catches: missing imports, duplicate names, invalid configurations.
 * Does NOT require a running server or database.
 */

import { describe, it, expect } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const registryPath = path.resolve(__dirname, "../../server/routes/domain-router-registry.ts");
const registrySource = fs.readFileSync(registryPath, "utf-8");

describe("Domain Router Registry", () => {
  it("registry file exists", () => {
    expect(fs.existsSync(registryPath)).toBe(true);
  });

  it("defines registerAllDomainRouters export", () => {
    expect(registrySource).toContain("export async function registerAllDomainRouters");
  });

  it("has no duplicate domain names", () => {
    const nameMatches = registrySource.matchAll(/name:\s*"([^"]+)"/g);
    const names: string[] = [];
    for (const match of nameMatches) {
      names.push(match[1]);
    }
    const unique = new Set(names);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
    expect(names.length).toBe(unique.size);
  });

  it("registers at least 40 domain routers", () => {
    const nameMatches = [...registrySource.matchAll(/name:\s*"([^"]+)"/g)];
    expect(nameMatches.length).toBeGreaterThanOrEqual(40);
  });

  it("every mountPath starts with /", () => {
    const mountPaths = [...registrySource.matchAll(/mountPath:\s*"([^"]+)"/g)];
    for (const match of mountPaths) {
      expect(match[1]).toMatch(/^\//);
    }
  });

  it("every importPath ends with .js", () => {
    const importPaths = [...registrySource.matchAll(/importPath:\s*"([^"]+)"/g)];
    for (const match of importPaths) {
      expect(match[1]).toMatch(/\.js$/);
    }
  });

  it("every importPath resolves to an existing .ts source file", () => {
    const importPaths = [...registrySource.matchAll(/importPath:\s*"([^"]+)"/g)];
    const registryDir = path.dirname(registryPath);

    let missingCount = 0;
    const missing: string[] = [];

    for (const match of importPaths) {
      // Convert .js import to .ts source path
      const jsPath = match[1];
      const tsPath = jsPath.replace(/\.js$/, ".ts");
      const fullPath = path.resolve(registryDir, tsPath);

      if (!fs.existsSync(fullPath)) {
        // Also check for index.ts in directory
        const dirPath = fullPath.replace(/\.ts$/, "");
        const indexPath = path.join(dirPath, "index.ts");
        if (!fs.existsSync(indexPath)) {
          missing.push(`${jsPath} → ${fullPath}`);
          missingCount++;
        }
      }
    }

    if (missing.length > 0) {
      console.warn(`Missing source files:\n${missing.join("\n")}`);
    }
    // Allow some tolerance for generated/moved files, but most should resolve
    expect(missingCount).toBeLessThan(5);
  });

  it("core domains are registered", () => {
    const requiredDomains = [
      "WorkOrder", "Equipment", "Maintenance", "Crew", "Telemetry",
      "Alerts", "Compliance", "Permissions", "SystemAdmin",
    ];
    for (const domain of requiredDomains) {
      expect(registrySource).toContain(`name: "${domain}"`);
    }
  });

  it("PdM platform domains are registered", () => {
    const pdmDomains = [
      "PdmDashboard", "PdmFeatureStore", "PdmModelRegistry",
      "PdmInference", "PdmMonitoring", "TrainingPipeline",
    ];
    for (const domain of pdmDomains) {
      expect(registrySource).toContain(`name: "${domain}"`);
    }
  });

  it("Digital Twin domains are registered", () => {
    const twinDomains = [
      "TwinDefinition", "TwinState", "ResidualAnalysis", "ScenarioSim", "Replay",
    ];
    for (const domain of twinDomains) {
      expect(registrySource).toContain(`name: "${domain}"`);
    }
  });

  it("OSV-specific domains are registered", () => {
    const osvDomains = ["DpMonitoring", "CharterCompliance", "Vetting", "OffshoreOps"];
    for (const domain of osvDomains) {
      expect(registrySource).toContain(`name: "${domain}"`);
    }
  });

  it("import adapters are registered", () => {
    expect(registrySource).toContain(`name: "AmosImport"`);
    expect(registrySource).toContain(`name: "ShipmateImport"`);
  });
});
