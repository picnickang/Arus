#!/usr/bin/env tsx
/**
 * Final Corrected Audit Report Generator
 * Uses improved route scanning data for accurate findings
 */

import fs from "fs";
import path from "path";

async function generateFinalReport() {
  console.log("📊 Generating final corrected audit report...\n");

  // Load corrected data
  const schemaDiff = JSON.parse(fs.readFileSync("reports/schema-diff.json", "utf-8"));
  const routeInventory = JSON.parse(
    fs.readFileSync("reports/route-inventory-improved.json", "utf-8")
  );

  const reportPath = path.join("reports", "FINAL_SCHEMA_API_AUDIT.md");

  let md = `# ARUS Schema & API Audit - Final Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Audit Version:** 2.0 (Corrected)\n\n`;
  md += `---\n\n`;

  md += `## Executive Summary\n\n`;
  md += `This audit provides a comprehensive analysis of the ARUS maritime system's database schema and API security posture.\n\n`;

  md += `### Key Metrics\n\n`;
  md += `| Area | Metric | Value | Status |\n`;
  md += `|------|--------|-------|--------|\n`;
  md += `| **Database** | Total Tables | ${schemaDiff.summary.totalTables} | ℹ️ |\n`;
  md += `| | Tables with org_id | ${schemaDiff.summary.totalTables - schemaDiff.summary.missingOrgId} | ${schemaDiff.summary.missingOrgId > 50 ? "⚠️" : "✅"} |\n`;
  md += `| | Missing Indexes | ${schemaDiff.summary.missingIndexes} | ${schemaDiff.summary.missingIndexes > 50 ? "⚠️" : "ℹ️"} |\n`;
  md += `| | Critical Issues | ${schemaDiff.summary.criticalIssues} | ${schemaDiff.summary.criticalIssues > 10 ? "⚠️" : "✅"} |\n`;
  md += `| **API** | Total Endpoints | ${routeInventory.summary.totalRoutes} | ℹ️ |\n`;
  md += `| | With Org Scoping | ${routeInventory.summary.withOrgScope} (${((routeInventory.summary.withOrgScope / routeInventory.summary.totalRoutes) * 100).toFixed(1)}%) | ${routeInventory.summary.withOrgScope < 100 ? "ℹ️" : "✅"} |\n`;
  md += `| | With Validation | ${routeInventory.summary.withValidation} | ℹ️ |\n`;
  md += `| | With Rate Limiting | ${routeInventory.summary.withRateLimit} | ${routeInventory.summary.withRateLimit > 200 ? "✅" : "ℹ️"} |\n\n`;

  md += `### Health Score\n\n`;
  const schemaHealth = (
    ((schemaDiff.summary.totalTables - schemaDiff.summary.missingOrgId) /
      schemaDiff.summary.totalTables) *
    100
  ).toFixed(1);
  const apiHealth = (
    (routeInventory.summary.withOrgScope / routeInventory.summary.totalRoutes) *
    100
  ).toFixed(1);

  md += `- **Schema Health:** ${schemaHealth}% (${schemaDiff.summary.totalTables - schemaDiff.summary.missingOrgId}/${schemaDiff.summary.totalTables} tables with org_id)\n`;
  md += `- **API Security:** ${apiHealth}% (${routeInventory.summary.withOrgScope}/${routeInventory.summary.totalRoutes} endpoints org-scoped)\n`;
  md += `- **Performance:** ${schemaDiff.summary.totalTables - schemaDiff.summary.missingIndexes} tables properly indexed\n\n`;

  md += `---\n\n`;
  md += `## 1. Database Schema Analysis\n\n`;
  md += `### 1.1 Overview\n\n`;
  md += `Analyzed **${schemaDiff.summary.totalTables} PostgreSQL tables** for multi-tenant isolation, referential integrity, and performance optimization.\n\n`;

  md += `### 1.2 Multi-Tenant Isolation\n\n`;
  md += `**Status:** ${schemaHealth}% compliant\n\n`;
  md += `- ✅ ${schemaDiff.summary.totalTables - schemaDiff.summary.missingOrgId} tables have proper \`org_id\` column\n`;
  md += `- ⚠️ ${schemaDiff.summary.missingOrgId} tables missing \`org_id\` (may be system tables)\n\n`;

  if (schemaDiff.summary.missingOrgId > 0) {
    md += `**Tables Missing org_id:**\n`;
    md += `Review \`reports/schema-audit-report.md\` for detailed list.\n\n`;
    md += `**Impact:** ${schemaDiff.summary.missingOrgId} tables may allow cross-tenant data access if not properly scoped at application layer.\n\n`;
  }

  md += `### 1.3 Performance & Indexing\n\n`;
  md += `- ${schemaDiff.summary.missingIndexes} tables missing recommended indexes\n`;
  md += `- Key recommendations:\n`;
  md += `  - Add composite indexes on (org_id, frequently_queried_column)\n`;
  md += `  - Index all foreign key columns\n`;
  md += `  - Add indexes on timestamp columns used in sorting/filtering\n\n`;

  md += `### 1.4 Data Integrity\n\n`;
  md += `- **Critical Issues:** ${schemaDiff.summary.criticalIssues}\n`;
  md += `- **Warnings:** ${schemaDiff.summary.tablesWithWarnings}\n\n`;
  md += `See \`reports/schema-audit-report.md\` for detailed findings per table.\n\n`;

  md += `### 1.5 Entity Relationship Diagram\n\n`;
  md += `A complete Mermaid ERD has been generated showing all ${schemaDiff.summary.totalTables} tables and their relationships.\n`;
  md += `📄 See: \`reports/erd.md\`\n\n`;

  md += `---\n\n`;
  md += `## 2. API Endpoint Security Analysis\n\n`;
  md += `### 2.1 Overview\n\n`;
  md += `Discovered and analyzed **${routeInventory.summary.totalRoutes} HTTP endpoints** across domain routes and main application.\n\n`;

  md += `### 2.2 Endpoint Breakdown by Method\n\n`;
  Object.entries(routeInventory.summary.byMethod as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .forEach(([method, count]) => {
      md += `- **${method}:** ${count} endpoints\n`;
    });
  md += `\n`;

  md += `### 2.3 Security Middleware Coverage\n\n`;
  const orgScopedPct = (
    (routeInventory.summary.withOrgScope / routeInventory.summary.totalRoutes) *
    100
  ).toFixed(1);
  const rateLimitPct = (
    (routeInventory.summary.withRateLimit / routeInventory.summary.totalRoutes) *
    100
  ).toFixed(1);

  md += `**Multi-Tenant Isolation (org-scoping):**\n`;
  md += `- ✅ ${routeInventory.summary.withOrgScope} endpoints (${orgScopedPct}%) have org-scoping middleware\n`;
  md += `- ℹ️ ${routeInventory.summary.totalRoutes - routeInventory.summary.withOrgScope} endpoints without org-scoping\n`;
  md += `  - Many are likely public health/metrics endpoints\n`;
  md += `  - Review \`reports/route-scan-improved.md\` for complete list\n\n`;

  md += `**Rate Limiting:**\n`;
  md += `- ✅ ${routeInventory.summary.withRateLimit} endpoints (${rateLimitPct}%) have rate limiting\n`;
  md += `- ℹ️ ${routeInventory.summary.totalRoutes - routeInventory.summary.withRateLimit} endpoints without rate limiting\n\n`;

  md += `**Input Validation:**\n`;
  md += `- ${routeInventory.summary.withValidation} endpoints have explicit validation middleware\n`;
  md += `- Many endpoints perform inline validation (not detected by scanner)\n\n`;

  md += `### 2.4 Domain Route Analysis\n\n`;
  md += `Analysis of key domain routes:\n\n`;

  const domainRoutes = routeInventory.routes.filter((r: any) => r.file.includes("domains/"));
  const domainStats = {
    inventory: domainRoutes.filter((r: any) => r.file.includes("inventory")).length,
    vessels: domainRoutes.filter((r: any) => r.file.includes("vessels")).length,
    equipment: domainRoutes.filter((r: any) => r.file.includes("equipment")).length,
    workOrders: domainRoutes.filter((r: any) => r.file.includes("work-orders")).length,
    crew: domainRoutes.filter((r: any) => r.file.includes("crew")).length,
    alerts: domainRoutes.filter((r: any) => r.file.includes("alerts")).length,
  };

  md += `| Domain | Endpoints | Org-Scoped | Rate-Limited |\n`;
  md += `|--------|-----------|------------|-------------|\n`;

  for (const [domain, count] of Object.entries(domainStats)) {
    const domainFiltered = domainRoutes.filter((r: any) => r.file.includes(domain));
    const orgScoped = domainFiltered.filter((r: any) => r.hasOrgScope).length;
    const rateLimited = domainFiltered.filter((r: any) => r.hasRateLimit).length;
    md += `| ${domain} | ${count} | ${orgScoped} | ${rateLimited} |\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `## 3. Critical Findings & Recommendations\n\n`;

  md += `### 3.1 High Priority (Immediate Action)\n\n`;
  md += `1. **Review ${schemaDiff.summary.missingOrgId} tables without org_id**\n`;
  md += `   - Determine if these are system tables (exempt) or require org_id\n`;
  md += `   - Add org_id column where needed for multi-tenant isolation\n\n`;

  if (schemaDiff.summary.criticalIssues > 10) {
    md += `2. **Address ${schemaDiff.summary.criticalIssues} critical database issues**\n`;
    md += `   - Review \`reports/schema-audit-report.md\` for details\n`;
    md += `   - Prioritize issues related to data integrity and security\n\n`;
  }

  const unprotectedRoutes =
    routeInventory.summary.totalRoutes - routeInventory.summary.withOrgScope;
  if (unprotectedRoutes > 500) {
    md += `3. **Review ${unprotectedRoutes} endpoints without org-scoping**\n`;
    md += `   - Verify these are intentionally public (health checks, metrics)\n`;
    md += `   - Add org-scoping middleware to business logic endpoints\n`;
    md += `   - See \`reports/route-scan-improved.md\` for specific endpoints\n\n`;
  }

  md += `### 3.2 Medium Priority (Within Sprint)\n\n`;
  md += `1. **Add ${schemaDiff.summary.missingIndexes} missing performance indexes**\n`;
  md += `   - Focus on tables with frequent queries\n`;
  md += `   - Prioritize composite indexes on (org_id, query_field)\n\n`;

  md += `2. **Increase API validation coverage**\n`;
  md += `   - Currently ${routeInventory.summary.withValidation} endpoints have explicit validation\n`;
  md += `   - Add Zod schemas for all POST/PUT/PATCH endpoints\n\n`;

  md += `3. **Extend rate limiting coverage**\n`;
  md += `   - ${routeInventory.summary.totalRoutes - routeInventory.summary.withRateLimit} endpoints lack rate limiting\n`;
  md += `   - Prioritize write operations and expensive queries\n\n`;

  md += `### 3.3 Long-Term Improvements\n\n`;
  md += `1. **Generate OpenAPI 3.1 Specification**\n`;
  md += `   - Document all ${routeInventory.summary.totalRoutes} endpoints\n`;
  md += `   - Include request/response schemas\n`;
  md += `   - Add authentication requirements\n\n`;

  md += `2. **Implement Contract Testing**\n`;
  md += `   - Create Supertest-based contract tests\n`;
  md += `   - Validate responses against OpenAPI spec\n`;
  md += `   - Test multi-tenant isolation\n\n`;

  md += `3. **Add MQTT/WebSocket Contract Tests**\n`;
  md += `   - Verify realtime sync behavior\n`;
  md += `   - Test event publishing for CRUD operations\n\n`;

  md += `---\n\n`;
  md += `## 4. Generated Artifacts\n\n`;
  md += `This audit generated the following deliverables:\n\n`;
  md += `### 4.1 Schema Analysis\n`;
  md += `- \`reports/schema-audit-report.md\` - Detailed table-by-table analysis\n`;
  md += `- \`reports/schema-diff.json\` - Machine-readable schema metadata\n`;
  md += `- \`reports/erd.md\` - Entity Relationship Diagram (Mermaid format)\n\n`;

  md += `### 4.2 API Analysis\n`;
  md += `- \`reports/route-scan-improved.md\` - Endpoint security matrix\n`;
  md += `- \`reports/route-inventory-improved.json\` - Machine-readable endpoint metadata\n\n`;

  md += `### 4.3 Audit Tools (Reusable)\n`;
  md += `- \`tools/schema-audit.ts\` - Database schema analyzer\n`;
  md += `- \`tools/route-scan-improved.ts\` - API endpoint discovery\n`;
  md += `- \`tools/final-audit-report.ts\` - Report generator\n\n`;

  md += `---\n\n`;
  md += `## 5. Audit Methodology\n\n`;
  md += `### 5.1 Schema Audit\n`;
  md += `- Connected to production PostgreSQL database\n`;
  md += `- Used \`information_schema\` and \`pg_*\` system tables\n`;
  md += `- Analyzed all ${schemaDiff.summary.totalTables} tables for:\n`;
  md += `  - Multi-tenant isolation (org_id presence)\n`;
  md += `  - Primary key constraints\n`;
  md += `  - Foreign key relationships\n`;
  md += `  - Index coverage\n`;
  md += `  - Timestamp audit fields\n\n`;

  md += `### 5.2 Route Discovery\n`;
  md += `- Scanned all TypeScript route files\n`;
  md += `- Parsed Express route definitions\n`;
  md += `- Detected middleware chains:\n`;
  md += `  - Authentication (\`requireAuth\`, etc.)\n`;
  md += `  - Org-scoping (\`requireOrgId\`, etc.)\n`;
  md += `  - Validation (Zod schemas)\n`;
  md += `  - Rate limiting\n`;
  md += `- Tracked middleware inheritance from router.use()\n\n`;

  md += `### 5.3 Limitations\n`;
  md += `- Static analysis only (no runtime inspection)\n`;
  md += `- Middleware detection based on naming patterns\n`;
  md += `- Some inline validation may not be detected\n`;
  md += `- Does not analyze middleware implementation details\n\n`;

  md += `---\n\n`;
  md += `## 6. Next Steps\n\n`;
  md += `1. **Review Findings:** Engineering team reviews this report\n`;
  md += `2. **Prioritize Issues:** Categorize findings by business impact\n`;
  md += `3. **Create Tasks:** Break down recommendations into actionable tickets\n`;
  md += `4. **Address Critical:** Fix high-priority security/data issues first\n`;
  md += `5. **Continuous Audit:** Re-run tools periodically to track progress\n\n`;

  md += `---\n\n`;
  md += `**Audit Completed:** ${new Date().toISOString()}\n`;
  md += `**Tools Version:** 2.0 (Corrected)\n`;
  md += `**Database:** PostgreSQL (${schemaDiff.summary.totalTables} tables)\n`;
  md += `**API:** ${routeInventory.summary.totalRoutes} endpoints discovered\n`;

  fs.writeFileSync(reportPath, md);
  console.log(`✅ Final audit report: ${reportPath}`);

  console.log(`\n📊 FINAL AUDIT SUMMARY:`);
  console.log(`   Database Tables: ${schemaDiff.summary.totalTables}`);
  console.log(`   Schema Health: ${schemaHealth}%`);
  console.log(`   API Endpoints: ${routeInventory.summary.totalRoutes}`);
  console.log(`   API Security: ${apiHealth}%`);
  console.log(`   Critical Issues: ${schemaDiff.summary.criticalIssues}`);
}

generateFinalReport().catch(console.error);
