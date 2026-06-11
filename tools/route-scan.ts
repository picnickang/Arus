#!/usr/bin/env tsx
/**
 * Route Scanner - Discovers all HTTP endpoints in the application
 * Analyzes route files to extract endpoint metadata for OpenAPI generation
 */

import fs from "fs";
import path from "path";
import { glob } from "glob";

interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line: number;
  hasAuth: boolean;
  hasOrgScope: boolean;
  hasValidation: boolean;
  hasRateLimit: boolean;
  middleware: string[];
}

interface ScanResult {
  routes: RouteInfo[];
  summary: {
    totalRoutes: number;
    byMethod: Record<string, number>;
    withAuth: number;
    withOrgScope: number;
    withValidation: number;
    withRateLimit: number;
  };
}

async function scanRoutes(): Promise<ScanResult> {
  console.log("🔍 Scanning for route definitions...\n");

  const routes: RouteInfo[] = [];

  // Find all route files
  const routeFiles = await glob("server/**/*.ts", {
    ignore: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
  });

  console.log(`Found ${routeFiles.length} TypeScript files to analyze\n`);

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    // Patterns to match Express route definitions
    const routePattern =
      /(app|router)\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/g;

    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const [fullMatch, obj, method, routePath] = match;

      // Skip middleware mounts (app.use with routers)
      if (method === "use" && !routePath.startsWith("/api")) continue;

      // Find line number
      const lineNumber = content.substring(0, match.index).split("\n").length;

      // Extract middleware and context from the line
      const lineContent = lines[lineNumber - 1];

      const hasAuth =
        lineContent.includes("requireAuth") ||
        lineContent.includes("authenticate") ||
        lineContent.includes("authMiddleware") ||
        lineContent.includes("adminOnly") ||
        lineContent.includes("requireAdminToken");

      const hasOrgScope =
        lineContent.includes("requireOrgId") ||
        lineContent.includes("orgContext") ||
        lineContent.includes("tenantScope");

      const hasValidation =
        lineContent.includes("validate") ||
        lineContent.includes("zod") ||
        lineContent.includes("Schema") ||
        content.substring(match.index, match.index + 500).includes(".safeParse") ||
        content.substring(match.index, match.index + 500).includes(".parse");

      const hasRateLimit =
        lineContent.includes("rateLimit") ||
        lineContent.includes("rateLimiter") ||
        lineContent.includes("writeOperationRateLimit") ||
        lineContent.includes("generalApiRateLimit");

      const middleware: string[] = [];
      if (hasAuth) middleware.push("auth");
      if (hasOrgScope) middleware.push("org-scope");
      if (hasValidation) middleware.push("validation");
      if (hasRateLimit) middleware.push("rate-limit");

      routes.push({
        method: method.toUpperCase(),
        path: routePath,
        file: file.replace(/^server\//, ""),
        line: lineNumber,
        hasAuth,
        hasOrgScope,
        hasValidation,
        hasRateLimit,
        middleware,
      });
    }
  }

  // Calculate summary
  const byMethod: Record<string, number> = {};
  let withAuth = 0;
  let withOrgScope = 0;
  let withValidation = 0;
  let withRateLimit = 0;

  for (const route of routes) {
    byMethod[route.method] = (byMethod[route.method] || 0) + 1;
    if (route.hasAuth) withAuth++;
    if (route.hasOrgScope) withOrgScope++;
    if (route.hasValidation) withValidation++;
    if (route.hasRateLimit) withRateLimit++;
  }

  return {
    routes,
    summary: {
      totalRoutes: routes.length,
      byMethod,
      withAuth,
      withOrgScope,
      withValidation,
      withRateLimit,
    },
  };
}

async function main() {
  try {
    const startTime = Date.now();
    const result = await scanRoutes();

    // Write route inventory
    const inventoryPath = path.join("reports", "route-inventory.json");
    fs.writeFileSync(inventoryPath, JSON.stringify(result, null, 2));
    console.log(`✅ Route inventory written to ${inventoryPath}`);

    // Write human-readable report
    const reportPath = path.join("reports", "route-scan-report.md");
    let report = `# Route Scan Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Total Routes:** ${result.summary.totalRoutes}\n`;
    report += `- **With Authentication:** ${result.summary.withAuth} (${((result.summary.withAuth / result.summary.totalRoutes) * 100).toFixed(1)}%)\n`;
    report += `- **With Org Scoping:** ${result.summary.withOrgScope} (${((result.summary.withOrgScope / result.summary.totalRoutes) * 100).toFixed(1)}%)\n`;
    report += `- **With Validation:** ${result.summary.withValidation} (${((result.summary.withValidation / result.summary.totalRoutes) * 100).toFixed(1)}%)\n`;
    report += `- **With Rate Limiting:** ${result.summary.withRateLimit} (${((result.summary.withRateLimit / result.summary.totalRoutes) * 100).toFixed(1)}%)\n\n`;

    report += `### By HTTP Method\n\n`;
    Object.entries(result.summary.byMethod)
      .sort((a, b) => b[1] - a[1])
      .forEach(([method, count]) => {
        report += `- ${method}: ${count}\n`;
      });

    report += `\n## Route Details\n\n`;
    report += `| Method | Path | Auth | Org | Validation | Rate Limit | File |\n`;
    report += `|--------|------|------|-----|------------|------------|------|\n`;

    const sortedRoutes = result.routes.sort((a, b) => a.path.localeCompare(b.path));
    for (const route of sortedRoutes) {
      const auth = route.hasAuth ? "✓" : "✗";
      const org = route.hasOrgScope ? "✓" : "✗";
      const val = route.hasValidation ? "✓" : "✗";
      const rate = route.hasRateLimit ? "✓" : "✗";
      report += `| ${route.method} | ${route.path} | ${auth} | ${org} | ${val} | ${rate} | ${route.file}:${route.line} |\n`;
    }

    fs.writeFileSync(reportPath, report);
    console.log(`✅ Route scan report written to ${reportPath}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Route scan completed in ${duration}s`);

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Routes: ${result.summary.totalRoutes}`);
    console.log(`   With Auth: ${result.summary.withAuth}`);
    console.log(`   With Org Scope: ${result.summary.withOrgScope}`);
    console.log(`   With Validation: ${result.summary.withValidation}`);

    // Security warnings
    const unprotected = result.summary.totalRoutes - result.summary.withAuth;
    if (unprotected > 20) {
      console.log(`\n⚠️  Warning: ${unprotected} routes without authentication`);
    }
  } catch (error) {
    console.error("❌ Route scan failed:", error);
    process.exit(1);
  }
}

main();
