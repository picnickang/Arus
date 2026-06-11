#!/usr/bin/env tsx
/**
 * Improved Route Scanner - Properly tracks middleware inheritance
 * Handles middleware from parent routers and app.use() mounts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
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
  inheritedMiddleware: string[];
}

interface MiddlewareMount {
  path: string;
  middleware: string[];
  file: string;
}

function detectMountMiddleware(content: string): string[] {
  const mountMiddleware: string[] = [];
  const routerUsePattern = /(router|app)\.use\s{0,10}\(\s{0,10}([^)]{1,500})\)/g;
  let match;

  while ((match = routerUsePattern.exec(content)) !== null) {
    const args = match[2];
    if (args.includes("Router") || (args.includes("router") && !args.includes("require"))) continue;

    if (args.includes("requireAuth") || args.includes("authenticate")) {
      mountMiddleware.push("auth");
    }
    if (args.includes("requireOrgId") || args.includes("orgContext")) {
      mountMiddleware.push("org-scope");
    }
    if (args.includes("rateLimit")) {
      mountMiddleware.push("rate-limit");
    }
  }
  return mountMiddleware;
}

function hasAuthMiddleware(middlewareChain: string, mountMiddleware: string[]): boolean {
  return (
    middlewareChain.includes("requireAuth") ||
    middlewareChain.includes("authenticate") ||
    middlewareChain.includes("authMiddleware") ||
    middlewareChain.includes("adminOnly") ||
    middlewareChain.includes("requireAdminToken") ||
    mountMiddleware.includes("auth")
  );
}

function hasOrgScopeMiddleware(middlewareChain: string, mountMiddleware: string[]): boolean {
  return (
    middlewareChain.includes("requireOrgId") ||
    middlewareChain.includes("orgContext") ||
    middlewareChain.includes("tenantScope") ||
    middlewareChain.includes("requireOrgIdAndValidateBody") ||
    mountMiddleware.includes("org-scope")
  );
}

function hasValidationMiddleware(middlewareChain: string): boolean {
  return (
    middlewareChain.includes("validate") ||
    middlewareChain.includes("zod") ||
    middlewareChain.includes("Schema")
  );
}

function hasRateLimitMiddleware(middlewareChain: string, mountMiddleware: string[]): boolean {
  return (
    middlewareChain.includes("rateLimit") ||
    middlewareChain.includes("rateLimiter") ||
    middlewareChain.includes("writeOperationRateLimit") ||
    middlewareChain.includes("generalApiRateLimit") ||
    mountMiddleware.includes("rate-limit")
  );
}

function buildMiddlewareList(
  hasAuth: boolean,
  hasOrgScope: boolean,
  hasValidation: boolean,
  hasRateLimit: boolean
): string[] {
  const middleware: string[] = [];
  if (hasAuth) middleware.push("auth");
  if (hasOrgScope) middleware.push("org-scope");
  if (hasValidation) middleware.push("validation");
  if (hasRateLimit) middleware.push("rate-limit");
  return middleware;
}

async function analyzeRouterFile(filePath: string): Promise<{
  routes: RouteInfo[];
  mountMiddleware: string[];
}> {
  const content = fs.readFileSync(filePath, "utf-8");
  const routes: RouteInfo[] = [];
  const mountMiddleware = detectMountMiddleware(content);

  const routePattern =
    /(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^{]+)/g;
  let match;

  while ((match = routePattern.exec(content)) !== null) {
    const [, , method, routePath, middlewareChain] = match;
    const lineNumber = content.substring(0, match.index).split("\n").length;

    const hasAuth = hasAuthMiddleware(middlewareChain, mountMiddleware);
    const hasOrgScope = hasOrgScopeMiddleware(middlewareChain, mountMiddleware);
    const hasValidation = hasValidationMiddleware(middlewareChain);
    const hasRateLimit = hasRateLimitMiddleware(middlewareChain, mountMiddleware);
    const middleware = buildMiddlewareList(hasAuth, hasOrgScope, hasValidation, hasRateLimit);

    routes.push({
      method: method.toUpperCase(),
      path: routePath,
      file: filePath.replace(/^server\//, ""),
      line: lineNumber,
      hasAuth,
      hasOrgScope,
      hasValidation,
      hasRateLimit,
      middleware,
      inheritedMiddleware: [...mountMiddleware],
    });
  }

  return { routes, mountMiddleware };
}

async function scanRoutes() {
  console.log("🔍 Improved route scanning with middleware inheritance tracking...\n");

  const allRoutes: RouteInfo[] = [];

  // Primary route files to analyze
  const primaryFiles = ["server/routes.ts", "server/index.ts"];

  // Domain-specific routes
  const domainFiles = await glob("server/domains/**/routes.ts");
  const routeFiles = [...primaryFiles, ...domainFiles];

  console.log(`Analyzing ${routeFiles.length} route files...\n`);

  for (const file of routeFiles) {
    if (!fs.existsSync(file)) continue;

    console.log(`  📄 ${file}`);
    const { routes, mountMiddleware } = await analyzeRouterFile(file);

    if (mountMiddleware.length > 0) {
      console.log(`     Router-level middleware: ${mountMiddleware.join(", ")}`);
    }
    console.log(`     Found ${routes.length} routes`);

    allRoutes.push(...routes);
  }

  // Calculate summary
  const summary = {
    totalRoutes: allRoutes.length,
    byMethod: {} as Record<string, number>,
    withAuth: allRoutes.filter((r) => r.hasAuth).length,
    withOrgScope: allRoutes.filter((r) => r.hasOrgScope).length,
    withValidation: allRoutes.filter((r) => r.hasValidation).length,
    withRateLimit: allRoutes.filter((r) => r.hasRateLimit).length,
    routerInherited: allRoutes.filter((r) => r.inheritedMiddleware.length > 0).length,
  };

  for (const route of allRoutes) {
    summary.byMethod[route.method] = (summary.byMethod[route.method] || 0) + 1;
  }

  return { routes: allRoutes, summary };
}

function calcPercent(value: number, total: number): string {
  return ((value / total) * 100).toFixed(1);
}

function generateSummarySection(summary: any): string {
  let report = `## Summary\n\n`;
  report += `- **Total Routes:** ${summary.totalRoutes}\n`;
  report += `- **With Authentication:** ${summary.withAuth} (${calcPercent(summary.withAuth, summary.totalRoutes)}%)\n`;
  report += `- **With Org Scoping:** ${summary.withOrgScope} (${calcPercent(summary.withOrgScope, summary.totalRoutes)}%)\n`;
  report += `- **With Validation:** ${summary.withValidation} (${calcPercent(summary.withValidation, summary.totalRoutes)}%)\n`;
  report += `- **With Rate Limiting:** ${summary.withRateLimit} (${calcPercent(summary.withRateLimit, summary.totalRoutes)}%)\n`;
  report += `- **With Inherited Middleware:** ${summary.routerInherited} (${calcPercent(summary.routerInherited, summary.totalRoutes)}%)\n\n`;

  report += `### By HTTP Method\n\n`;
  Object.entries(summary.byMethod)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .forEach(([method, count]) => {
      report += `- ${method}: ${count}\n`;
    });

  return report;
}

function generateSecurityCoverage(authPercent: string, orgPercent: string): string {
  let report = `\n### Security Coverage\n\n`;

  if (Number(authPercent) > 80) {
    report += `✅ **Strong authentication coverage** (${authPercent}%)\n\n`;
  } else if (Number(authPercent) > 50) {
    report += `⚠️ **Moderate authentication coverage** (${authPercent}%)\n\n`;
  } else {
    report += `🚨 **Low authentication coverage** (${authPercent}%) - Review public endpoints\n\n`;
  }

  if (Number(orgPercent) > 70) {
    report += `✅ **Strong multi-tenant isolation** (${orgPercent}%)\n\n`;
  } else {
    report += `⚠️ **Review multi-tenant isolation** (${orgPercent}%) - Many routes may be public\n\n`;
  }

  return report;
}

function formatRouteList(routes: RouteInfo[], title: string, description: string): string {
  if (routes.length === 0) return "";
  let report = `### ${title}\n\n`;
  report += `${description}:\n\n`;
  routes.slice(0, 10).forEach((route) => {
    report += `- ${route.method} ${route.path} (${route.file}:${route.line})\n`;
  });
  if (routes.length > 10) {
    report += `- ... and ${routes.length - 10} more\n`;
  }
  return report + `\n`;
}

function generateRouteTable(routes: RouteInfo[]): string {
  let report = `## Route Details\n\n`;
  report += `| Method | Path | Auth | Org | Validation | Rate Limit | Inherited | File |\n`;
  report += `|--------|------|------|-----|------------|------------|-----------|------|\n`;

  const sortedRoutes = routes.sort((a, b) => a.path.localeCompare(b.path));
  for (const route of sortedRoutes.slice(0, 100)) {
    const auth = route.hasAuth ? "✓" : "✗";
    const org = route.hasOrgScope ? "✓" : "✗";
    const val = route.hasValidation ? "✓" : "✗";
    const rate = route.hasRateLimit ? "✓" : "✗";
    const inherited = route.inheritedMiddleware.length > 0 ? "✓" : "✗";
    report += `| ${route.method} | ${route.path} | ${auth} | ${org} | ${val} | ${rate} | ${inherited} | ${route.file}:${route.line} |\n`;
  }

  if (sortedRoutes.length > 100) {
    report += `\n*Showing first 100 of ${sortedRoutes.length} routes. See JSON for complete list.*\n`;
  }
  return report;
}

async function main() {
  try {
    const startTime = Date.now();
    const result = await scanRoutes();

    const inventoryPath = path.join("reports", "route-inventory-improved.json");
    fs.writeFileSync(inventoryPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Improved route inventory: ${inventoryPath}`);

    const authPercent = calcPercent(result.summary.withAuth, result.summary.totalRoutes);
    const orgPercent = calcPercent(result.summary.withOrgScope, result.summary.totalRoutes);

    let report = `# Improved Route Scan Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += generateSummarySection(result.summary);
    report += generateSecurityCoverage(authPercent, orgPercent);
    report += `## Critical Security Findings\n\n`;

    const unprotected = result.routes.filter(
      (r) =>
        !r.hasAuth &&
        !r.path.includes("/health") &&
        !r.path.includes("/metrics") &&
        !r.path.includes("/public") &&
        r.method !== "GET"
    );
    report += formatRouteList(
      unprotected,
      "Unprotected Write Operations",
      `Found ${unprotected.length} write operations (POST/PUT/PATCH/DELETE) without authentication`
    );

    const noOrgScope = result.routes.filter(
      (r) =>
        !r.hasOrgScope && r.hasAuth && !r.path.includes("/admin") && !r.path.includes("/system")
    );
    report += formatRouteList(
      noOrgScope,
      "Authenticated but Not Org-Scoped",
      `Found ${noOrgScope.length} authenticated routes without org-scoping`
    );

    report += generateRouteTable(result.routes);

    const reportPath = path.join("reports", "route-scan-improved.md");
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Improved route report: ${reportPath}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Improved scan completed in ${duration}s`);
    console.log(`\n📊 IMPROVED SUMMARY:`);
    console.log(`   Total Routes: ${result.summary.totalRoutes}`);
    console.log(`   With Auth: ${result.summary.withAuth} (${authPercent}%)`);
    console.log(`   With Org Scope: ${result.summary.withOrgScope} (${orgPercent}%)`);
    console.log(`   With Validation: ${result.summary.withValidation}`);
    console.log(`   Router-Inherited: ${result.summary.routerInherited}`);
  } catch (error) {
    console.error("❌ Improved route scan failed:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Route scan error:", error);
  process.exit(1);
});
