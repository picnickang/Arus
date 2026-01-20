#!/usr/bin/env tsx
/**
 * Comprehensive Audit Report Generator
 * Compiles all audit findings into a single report
 */

import fs from 'fs';
import path from 'path';

interface AuditReport {
  generatedAt: string;
  schema: {
    totalTables: number;
    criticalIssues: number;
    warnings: number;
    missingOrgId: number;
    missingIndexes: number;
  };
  routes: {
    totalRoutes: number;
    withAuth: number;
    withOrgScope: number;
    withValidation: number;
    withRateLimit: number;
  };
  recommendations: string[];
  criticalFindings: string[];
}

async function generateReport(): Promise<AuditReport> {
  console.log('📊 Generating comprehensive audit report...\n');
  
  // Load schema audit results
  const schemaDiff = JSON.parse(
    fs.readFileSync('reports/schema-diff.json', 'utf-8')
  );
  
  // Load route inventory
  const routeInventory = JSON.parse(
    fs.readFileSync('reports/route-inventory.json', 'utf-8')
  );
  
  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    schema: {
      totalTables: schemaDiff.summary.totalTables,
      criticalIssues: schemaDiff.summary.criticalIssues,
      warnings: schemaDiff.summary.tablesWithWarnings,
      missingOrgId: schemaDiff.summary.missingOrgId,
      missingIndexes: schemaDiff.summary.missingIndexes
    },
    routes: {
      totalRoutes: routeInventory.summary.totalRoutes,
      withAuth: routeInventory.summary.withAuth,
      withOrgScope: routeInventory.summary.withOrgScope,
      withValidation: routeInventory.summary.withValidation,
      withRateLimit: routeInventory.summary.withRateLimit
    },
    recommendations: [],
    criticalFindings: []
  };
  
  // Generate critical findings
  if (report.schema.missingOrgId > 0) {
    report.criticalFindings.push(
      `${report.schema.missingOrgId} tables missing org_id for multi-tenant isolation`
    );
  }
  
  if (report.schema.missingIndexes > 50) {
    report.criticalFindings.push(
      `${report.schema.missingIndexes} tables missing performance indexes`
    );
  }
  
  const unprotectedRoutes = report.routes.totalRoutes - report.routes.withAuth;
  const publicRoutes = report.routes.totalRoutes - report.routes.withOrgScope;
  
  if (publicRoutes > 100) {
    report.criticalFindings.push(
      `${publicRoutes} routes not org-scoped (many may be public/health endpoints)`
    );
  }
  
  // Generate recommendations
  report.recommendations = [
    ...schemaDiff.recommendations,
    `Review ${unprotectedRoutes} routes for proper authentication requirements`,
    `Ensure ${publicRoutes} non-org-scoped routes are intentionally public`,
    `Add validation middleware to ${report.routes.totalRoutes - report.routes.withValidation} routes`,
    `Add rate limiting to ${report.routes.totalRoutes - report.routes.withRateLimit} routes`
  ];
  
  return report;
}

async function main() {
  try {
    const report = await generateReport();
    
    // Write JSON report
    const jsonPath = path.join('reports', 'audit-summary.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`✅ Audit summary written to ${jsonPath}`);
    
    // Generate comprehensive markdown report
    const reportPath = path.join('reports', 'SCHEMA_AND_API_AUDIT_REPORT.md');
    let md = `# ARUS Schema & API Comprehensive Audit Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    md += `---\n\n`;
    
    md += `## Executive Summary\n\n`;
    md += `This comprehensive audit analyzes the ARUS maritime predictive maintenance system's database schema and API endpoints for correctness, security, performance, and multi-tenant isolation.\n\n`;
    
    md += `### Key Metrics\n\n`;
    md += `| Category | Metric | Count |\n`;
    md += `|----------|--------|-------|\n`;
    md += `| **Database** | Total Tables | ${report.schema.totalTables} |\n`;
    md += `| | Critical Issues | ${report.schema.criticalIssues} |\n`;
    md += `| | Warnings | ${report.schema.warnings} |\n`;
    md += `| | Missing OrgId | ${report.schema.missingOrgId} |\n`;
    md += `| | Missing Indexes | ${report.schema.missingIndexes} |\n`;
    md += `| **API** | Total Routes | ${report.routes.totalRoutes} |\n`;
    md += `| | With Authentication | ${report.routes.withAuth} |\n`;
    md += `| | With Org Scoping | ${report.routes.withOrgScope} |\n`;
    md += `| | With Validation | ${report.routes.withValidation} |\n`;
    md += `| | With Rate Limiting | ${report.routes.withRateLimit} |\n\n`;
    
    md += `### Critical Findings\n\n`;
    if (report.criticalFindings.length === 0) {
      md += `✅ No critical security or data integrity issues found.\n\n`;
    } else {
      report.criticalFindings.forEach((finding, i) => {
        md += `${i + 1}. 🚨 **${finding}**\n`;
      });
      md += `\n`;
    }
    
    md += `### Overall Assessment\n\n`;
    const schemaHealth = ((report.schema.totalTables - report.schema.missingOrgId) / report.schema.totalTables * 100).toFixed(1);
    const apiHealth = (report.routes.withOrgScope / report.routes.totalRoutes * 100).toFixed(1);
    
    md += `- **Schema Health:** ${schemaHealth}% of tables have proper org_id isolation\n`;
    md += `- **API Health:** ${apiHealth}% of routes have org scoping\n`;
    md += `- **Security Posture:** ${report.routes.withValidation} routes with input validation\n`;
    md += `- **Performance:** ${report.schema.totalTables - report.schema.missingIndexes} tables properly indexed\n\n`;
    
    md += `---\n\n`;
    md += `## 1. Database Schema Audit\n\n`;
    md += `### Overview\n\n`;
    md += `Analyzed ${report.schema.totalTables} database tables for:\n`;
    md += `- Multi-tenant isolation (org_id presence)\n`;
    md += `- Primary keys and foreign key constraints\n`;
    md += `- Performance indexes\n`;
    md += `- Timestamp audit fields\n`;
    md += `- Data integrity constraints\n\n`;
    
    md += `### Key Findings\n\n`;
    md += `**Multi-Tenant Isolation:**\n`;
    md += `- ${report.schema.totalTables - report.schema.missingOrgId} tables properly scoped with org_id\n`;
    md += `- ${report.schema.missingOrgId} tables missing org_id (may be exempt system tables)\n\n`;
    
    md += `**Performance:**\n`;
    md += `- ${report.schema.missingIndexes} tables missing recommended indexes\n`;
    md += `- Critical indexes needed on: org_id, foreign keys, frequently filtered columns\n\n`;
    
    md += `**Data Integrity:**\n`;
    md += `- ${report.schema.criticalIssues} critical issues requiring immediate attention\n`;
    md += `- See detailed findings in \`reports/schema-audit-report.md\`\n\n`;
    
    md += `### Entity Relationship Diagram\n\n`;
    md += `A complete Mermaid ERD has been generated showing all table relationships.\n`;
    md += `See: \`reports/erd.md\`\n\n`;
    
    md += `---\n\n`;
    md += `## 2. API Endpoint Audit\n\n`;
    md += `### Overview\n\n`;
    md += `Discovered and analyzed ${report.routes.totalRoutes} API endpoints across the application.\n\n`;
    
    md += `### Security Analysis\n\n`;
    md += `**Authentication:**\n`;
    md += `- ${report.routes.withAuth} routes with explicit auth middleware\n`;
    md += `- ${report.routes.totalRoutes - report.routes.withAuth} routes without detected auth (may include public health endpoints)\n\n`;
    
    md += `**Multi-Tenant Isolation:**\n`;
    md += `- ${report.routes.withOrgScope} routes with org-scoping middleware\n`;
    md += `- ${report.routes.totalRoutes - report.routes.withOrgScope} routes without org-scoping (includes public endpoints)\n\n`;
    
    md += `**Input Validation:**\n`;
    md += `- ${report.routes.withValidation} routes with Zod/validation\n`;
    md += `- ${report.routes.totalRoutes - report.routes.withValidation} routes without detected validation\n\n`;
    
    md += `**Rate Limiting:**\n`;
    md += `- ${report.routes.withRateLimit} routes with rate limiting\n`;
    md += `- ${report.routes.totalRoutes - report.routes.withRateLimit} routes without rate limiting\n\n`;
    
    md += `### Route Inventory\n\n`;
    md += `Complete route details with security attributes available in:\n`;
    md += `- \`reports/route-scan-report.md\` (human-readable)\n`;
    md += `- \`reports/route-inventory.json\` (machine-readable)\n\n`;
    
    md += `---\n\n`;
    md += `## 3. Recommendations\n\n`;
    md += `### High Priority\n\n`;
    let priority = 1;
    report.recommendations.slice(0, 5).forEach((rec) => {
      md += `${priority++}. ${rec}\n`;
    });
    
    md += `\n### Medium Priority\n\n`;
    report.recommendations.slice(5, 10).forEach((rec) => {
      md += `${priority++}. ${rec}\n`;
    });
    
    if (report.recommendations.length > 10) {
      md += `\n### Additional Recommendations\n\n`;
      report.recommendations.slice(10).forEach((rec) => {
        md += `- ${rec}\n`;
      });
    }
    
    md += `\n---\n\n`;
    md += `## 4. Generated Artifacts\n\n`;
    md += `This audit has generated the following artifacts:\n\n`;
    md += `1. **Schema Reports:**\n`;
    md += `   - \`reports/schema-audit-report.md\` - Detailed schema analysis\n`;
    md += `   - \`reports/schema-diff.json\` - Machine-readable schema data\n`;
    md += `   - \`reports/erd.md\` - Entity Relationship Diagram (Mermaid)\n\n`;
    md += `2. **API Reports:**\n`;
    md += `   - \`reports/route-scan-report.md\` - Route inventory with security matrix\n`;
    md += `   - \`reports/route-inventory.json\` - Machine-readable route data\n\n`;
    md += `3. **Summary:**\n`;
    md += `   - \`reports/audit-summary.json\` - Executive summary data\n`;
    md += `   - \`reports/SCHEMA_AND_API_AUDIT_REPORT.md\` - This comprehensive report\n\n`;
    
    md += `---\n\n`;
    md += `## 5. Next Steps\n\n`;
    md += `1. **Review Critical Issues:** Address ${report.schema.criticalIssues} critical database issues\n`;
    md += `2. **Add Missing Indexes:** Implement ${report.schema.missingIndexes} performance indexes\n`;
    md += `3. **Secure Endpoints:** Review routes without org-scoping or validation\n`;
    md += `4. **Add Rate Limiting:** Protect endpoints from abuse\n`;
    md += `5. **Contract Testing:** Implement automated API contract tests\n`;
    md += `6. **OpenAPI Spec:** Generate OpenAPI 3.1 spec for documentation\n\n`;
    
    md += `---\n\n`;
    md += `*Audit completed: ${new Date().toISOString()}*\n`;
    
    fs.writeFileSync(reportPath, md);
    console.log(`✅ Comprehensive audit report written to ${reportPath}`);
    
    console.log(`\n✅ Audit report generation complete!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Database Tables: ${report.schema.totalTables}`);
    console.log(`   API Endpoints: ${report.routes.totalRoutes}`);
    console.log(`   Critical Issues: ${report.schema.criticalIssues}`);
    console.log(`   Recommendations: ${report.recommendations.length}`);
    
  } catch (error) {
    console.error('❌ Audit report generation failed:', error);
    process.exit(1);
  }
}

main();
