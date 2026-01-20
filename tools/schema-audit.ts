#!/usr/bin/env tsx
/**
 * Comprehensive Schema Audit Tool
 * Analyzes all database tables for correctness, safety, and performance
 */

import { sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import * as schema from '../shared/schema';
import fs from 'fs';
import path from 'path';

interface TableAudit {
  tableName: string;
  issues: string[];
  warnings: string[];
  info: string[];
  hasOrgId: boolean;
  hasPrimaryKey: boolean;
  hasTimestamps: boolean;
  indexes: string[];
  foreignKeys: string[];
}

interface SchemaAuditResult {
  tables: TableAudit[];
  summary: {
    totalTables: number;
    tablesWithIssues: number;
    tablesWithWarnings: number;
    criticalIssues: number;
    missingOrgId: number;
    missingPrimaryKey: number;
    missingIndexes: number;
  };
  mermaidERD: string;
  recommendations: string[];
}

const MULTI_TENANT_EXEMPT_TABLES = [
  'sync_journal',
  'event_log',
  'system_config',
  'migrations',
  'drizzle_migrations',
  'pg_stat',
  'schema_migrations'
];

async function auditSchema(): Promise<SchemaAuditResult> {
  console.log('🔍 Starting comprehensive schema audit...\n');
  
  const tableAudits: TableAudit[] = [];
  const mermaidRelations: string[] = [];
  const mermaidEntities: string[] = [];
  
  // Get all table information from Postgres
  const tablesQuery = await db.execute(sql`
    SELECT 
      table_name,
      table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  console.log(`Found ${tablesQuery.rows.length} tables in database\n`);
  
  for (const tableRow of tablesQuery.rows) {
    const tableName = tableRow.table_name as string;
    const audit: TableAudit = {
      tableName,
      issues: [],
      warnings: [],
      info: [],
      hasOrgId: false,
      hasPrimaryKey: false,
      hasTimestamps: false,
      indexes: [],
      foreignKeys: []
    };
    
    // Get column information
    const columnsQuery = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ORDER BY ordinal_position
    `);
    
    const columns = columnsQuery.rows.map(r => ({
      name: r.column_name as string,
      type: r.data_type as string,
      nullable: r.is_nullable === 'YES',
      default: r.column_default as string | null
    }));
    
    // Check for orgId
    const hasOrgId = columns.some(c => c.name === 'org_id' || c.name === 'orgId');
    audit.hasOrgId = hasOrgId;
    
    // Check for primary key
    const pkQuery = await db.execute(sql`
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = ${tableName}::regclass
        AND i.indisprimary
    `);
    
    audit.hasPrimaryKey = pkQuery.rows.length > 0;
    const pkColumns = pkQuery.rows.map(r => r.column_name as string);
    
    // Check for timestamps
    const hasCreatedAt = columns.some(c => c.name === 'created_at' || c.name === 'createdAt');
    const hasUpdatedAt = columns.some(c => c.name === 'updated_at' || c.name === 'updatedAt');
    audit.hasTimestamps = hasCreatedAt && hasUpdatedAt;
    
    // Get indexes
    const indexQuery = await db.execute(sql`
      SELECT
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = ${tableName}
        AND t.relkind = 'r'
      ORDER BY i.relname, a.attnum
    `);
    
    const indexNames = new Set(indexQuery.rows.map(r => r.index_name as string));
    audit.indexes = Array.from(indexNames);
    
    // Get foreign keys
    const fkQuery = await db.execute(sql`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ${tableName}
    `);
    
    audit.foreignKeys = fkQuery.rows.map(r => 
      `${r.column_name} -> ${r.foreign_table_name}(${r.foreign_column_name})`
    );
    
    // AUDIT CHECKS
    
    // Check 1: Multi-tenant tables should have orgId
    const isExempt = MULTI_TENANT_EXEMPT_TABLES.some(exempt => 
      tableName.toLowerCase().includes(exempt.toLowerCase())
    );
    
    if (!isExempt && !hasOrgId && !tableName.includes('_sqlite')) {
      audit.issues.push('CRITICAL: Missing org_id for multi-tenant isolation');
    }
    
    // Check 2: Every table should have a primary key
    if (!audit.hasPrimaryKey) {
      audit.issues.push('CRITICAL: Missing primary key');
    }
    
    // Check 3: Timestamps for audit trail
    if (!audit.hasTimestamps && !isExempt) {
      audit.warnings.push('Missing created_at/updated_at timestamps');
    }
    
    // Check 4: orgId should be NOT NULL if present
    const orgIdColumn = columns.find(c => c.name === 'org_id' || c.name === 'orgId');
    if (orgIdColumn && orgIdColumn.nullable && !isExempt) {
      audit.issues.push('CRITICAL: org_id should be NOT NULL');
    }
    
    // Check 5: Performance indexes for hot paths
    if (hasOrgId) {
      const hasOrgIdIndex = audit.indexes.some(idx => 
        idx.toLowerCase().includes('org_id') || idx.toLowerCase().includes('orgid')
      );
      if (!hasOrgIdIndex) {
        audit.warnings.push('Missing index on org_id for query performance');
      }
    }
    
    // Check 6: Orphan detection (tables with FKs should have indexes)
    for (const fk of audit.foreignKeys) {
      const columnName = fk.split(' -> ')[0];
      const hasFkIndex = audit.indexes.some(idx => idx.toLowerCase().includes(columnName.toLowerCase()));
      if (!hasFkIndex) {
        audit.warnings.push(`Missing index on FK column: ${columnName}`);
      }
    }
    
    // Check 7: Numeric columns for inventory/costs
    const numericColumns = columns.filter(c => 
      c.type.includes('numeric') || c.type.includes('decimal') || c.type.includes('real')
    );
    for (const col of numericColumns) {
      if (col.name.includes('cost') || col.name.includes('price') || col.name.includes('quantity')) {
        audit.info.push(`Numeric column: ${col.name} (${col.type})`);
      }
    }
    
    // Generate Mermaid entity
    const entityFields = columns.slice(0, 8).map(c => {
      const nullable = c.nullable ? '?' : '';
      const pk = pkColumns.includes(c.name) ? ' PK' : '';
      return `        ${c.type} ${c.name}${nullable}${pk}`;
    }).join('\n');
    
    mermaidEntities.push(`    ${tableName} {\n${entityFields}\n    }`);
    
    // Generate Mermaid relationships
    for (const fk of audit.foreignKeys) {
      const [col, target] = fk.split(' -> ');
      const [targetTable] = target.split('(');
      mermaidRelations.push(`    ${tableName} }|--|| ${targetTable} : "${col}"`);
    }
    
    tableAudits.push(audit);
  }
  
  // Generate Mermaid ERD
  const mermaidERD = `erDiagram\n${mermaidEntities.join('\n')}\n${mermaidRelations.join('\n')}`;
  
  // Generate summary
  const summary = {
    totalTables: tableAudits.length,
    tablesWithIssues: tableAudits.filter(t => t.issues.length > 0).length,
    tablesWithWarnings: tableAudits.filter(t => t.warnings.length > 0).length,
    criticalIssues: tableAudits.reduce((sum, t) => sum + t.issues.length, 0),
    missingOrgId: tableAudits.filter(t => !t.hasOrgId && 
      !MULTI_TENANT_EXEMPT_TABLES.some(e => t.tableName.includes(e))
    ).length,
    missingPrimaryKey: tableAudits.filter(t => !t.hasPrimaryKey).length,
    missingIndexes: tableAudits.filter(t => t.warnings.some(w => w.includes('index'))).length
  };
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (summary.missingOrgId > 0) {
    recommendations.push(`Add org_id to ${summary.missingOrgId} tables for multi-tenant isolation`);
  }
  
  if (summary.missingPrimaryKey > 0) {
    recommendations.push(`Add primary keys to ${summary.missingPrimaryKey} tables`);
  }
  
  if (summary.missingIndexes > 0) {
    recommendations.push(`Add performance indexes to ${summary.missingIndexes} tables`);
  }
  
  const tablesWithManyWarnings = tableAudits.filter(t => t.warnings.length > 3);
  if (tablesWithManyWarnings.length > 0) {
    recommendations.push(`Review ${tablesWithManyWarnings.length} tables with multiple warnings`);
  }
  
  return {
    tables: tableAudits,
    summary,
    mermaidERD,
    recommendations
  };
}

async function main() {
  try {
    const startTime = Date.now();
    const result = await auditSchema();
    
    // Write ERD
    const erdPath = path.join('reports', 'erd.md');
    fs.writeFileSync(erdPath, `# ARUS Database Schema - ERD\n\n\`\`\`mermaid\n${result.mermaidERD}\n\`\`\`\n`);
    console.log(`✅ ERD written to ${erdPath}`);
    
    // Write schema diff
    const diffPath = path.join('reports', 'schema-diff.json');
    fs.writeFileSync(diffPath, JSON.stringify(result, null, 2));
    console.log(`✅ Schema diff written to ${diffPath}`);
    
    // Write audit report
    const reportPath = path.join('reports', 'schema-audit-report.md');
    let report = `# Schema Audit Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Total Tables:** ${result.summary.totalTables}\n`;
    report += `- **Tables with Issues:** ${result.summary.tablesWithIssues}\n`;
    report += `- **Tables with Warnings:** ${result.summary.tablesWithWarnings}\n`;
    report += `- **Critical Issues:** ${result.summary.criticalIssues}\n`;
    report += `- **Missing orgId:** ${result.summary.missingOrgId}\n`;
    report += `- **Missing Primary Key:** ${result.summary.missingPrimaryKey}\n`;
    report += `- **Missing Indexes:** ${result.summary.missingIndexes}\n\n`;
    
    if (result.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      result.recommendations.forEach((rec, i) => {
        report += `${i + 1}. ${rec}\n`;
      });
      report += `\n`;
    }
    
    report += `## Table Details\n\n`;
    
    for (const table of result.tables) {
      if (table.issues.length === 0 && table.warnings.length === 0) continue;
      
      report += `### ${table.tableName}\n\n`;
      
      if (table.issues.length > 0) {
        report += `**Issues:**\n`;
        table.issues.forEach(issue => {
          report += `- ❌ ${issue}\n`;
        });
        report += `\n`;
      }
      
      if (table.warnings.length > 0) {
        report += `**Warnings:**\n`;
        table.warnings.forEach(warning => {
          report += `- ⚠️ ${warning}\n`;
        });
        report += `\n`;
      }
      
      report += `**Info:**\n`;
      report += `- Has orgId: ${table.hasOrgId ? '✓' : '✗'}\n`;
      report += `- Has Primary Key: ${table.hasPrimaryKey ? '✓' : '✗'}\n`;
      report += `- Has Timestamps: ${table.hasTimestamps ? '✓' : '✗'}\n`;
      report += `- Indexes: ${table.indexes.length}\n`;
      report += `- Foreign Keys: ${table.foreignKeys.length}\n\n`;
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Audit report written to ${reportPath}`);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Schema audit completed in ${duration}s`);
    
    // Print summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tables: ${result.summary.totalTables}`);
    console.log(`   Critical Issues: ${result.summary.criticalIssues}`);
    console.log(`   Warnings: ${result.summary.tablesWithWarnings}`);
    
    if (result.summary.criticalIssues === 0) {
      console.log(`\n✅ No critical issues found!`);
    } else {
      console.log(`\n⚠️  Found ${result.summary.criticalIssues} critical issues - review ${reportPath}`);
    }
    
  } catch (error) {
    console.error('❌ Schema audit failed:', error);
    process.exit(1);
  }
}

main();
