/**
 * Data Reconciliation - Main Service Class
 */

import { db } from '../../db';
import { equipment } from '../../../shared/schema';
import { sql } from 'drizzle-orm';
import type { ReconciliationReport, ReconciliationStatus, ReconciliationIssue } from './types.js';
import { reconciliationMetrics } from './metrics.js';
import { validateTelemetryIntegrity, validateAnomalyDetections, validateFailurePredictions, validateOrgConsistency } from './validators.js';

export class DataReconciliationService {
  private isRunning = false;
  private lastRun: Date | null = null;
  private totalRuns = 0;
  private successfulRuns = 0;
  private failedRuns = 0;
  private latestReport: ReconciliationReport | null = null;

  async runReconciliation(orgId: string): Promise<ReconciliationReport> {
    if (this.isRunning) { throw new Error('Reconciliation is already running'); }

    this.isRunning = true;
    const startTime = new Date();
    const runId = `recon-${orgId}-${startTime.getTime()}`;
    const endTimer = reconciliationMetrics.reconciliationDuration.startTimer({ operation: 'full_reconciliation' });

    try {
      console.log(`[Reconciliation] Starting for org: ${orgId}`);
      const issues: ReconciliationIssue[] = [];
      let recordsScanned = 0;

      const telemetryIssues = await validateTelemetryIntegrity(orgId);
      issues.push(...telemetryIssues.issues);
      recordsScanned += telemetryIssues.scanned;

      const anomalyIssues = await validateAnomalyDetections(orgId);
      issues.push(...anomalyIssues.issues);
      recordsScanned += anomalyIssues.scanned;

      const predictionIssues = await validateFailurePredictions(orgId);
      issues.push(...predictionIssues.issues);
      recordsScanned += predictionIssues.scanned;

      const orgIssues = await validateOrgConsistency(orgId);
      issues.push(...orgIssues.issues);
      recordsScanned += orgIssues.scanned;

      const summary = {
        missingEquipment: issues.filter(i => i.type === 'missing_equipment').length,
        invalidSensors: issues.filter(i => i.type === 'invalid_sensor').length,
        dataQualityIssues: issues.filter(i => i.type === 'data_quality').length,
        orgMismatches: issues.filter(i => i.type === 'org_mismatch').length,
        orphanedRecords: issues.filter(i => i.type === 'orphaned_record').length,
      };

      const dataQualityScore = recordsScanned > 0 ? Math.max(0, 1 - issues.length / recordsScanned) : 1;

      reconciliationMetrics.validationRuns.inc({ orgId, type: 'full' });
      reconciliationMetrics.dataQualityScore.set({ orgId, dataType: 'telemetry' }, dataQualityScore);
      issues.forEach(issue => reconciliationMetrics.issuesDetected.inc({ orgId, issueType: issue.type, severity: issue.severity }));

      const endTime = new Date();
      const report: ReconciliationReport = { orgId, runId, startTime, endTime, duration: endTime.getTime() - startTime.getTime(), recordsScanned, issuesDetected: issues.length, issues, dataQualityScore, summary };

      this.lastRun = endTime;
      this.latestReport = report;
      this.totalRuns++;
      this.successfulRuns++;

      console.log(`[Reconciliation] Completed for org: ${orgId}`, { recordsScanned, issuesDetected: issues.length, dataQualityScore: dataQualityScore.toFixed(3), duration: `${report.duration}ms` });
      return report;
    } catch (error) {
      this.totalRuns++;
      this.failedRuns++;
      throw error;
    } finally {
      this.isRunning = false;
      endTimer();
    }
  }

  getStatus(): ReconciliationStatus {
    return {
      enabled: true,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.lastRun ? new Date(this.lastRun.getTime() + 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000),
      totalRuns: this.totalRuns,
      successfulRuns: this.successfulRuns,
      failedRuns: this.failedRuns,
    };
  }

  getLatestReport(): ReconciliationReport | null {
    return this.latestReport;
  }

  startScheduledReconciliation(intervalMinutes: number = 60): void {
    console.log(`[Reconciliation] Scheduling automatic runs every ${intervalMinutes} minutes`);
    setInterval(async () => {
      try {
        const orgs = await db.selectDistinct({ orgId: equipment.orgId }).from(equipment).where(sql`${equipment.orgId} IS NOT NULL`);
        for (const { orgId } of orgs) {
          if (orgId) {
            console.log(`[Reconciliation] Running scheduled reconciliation for org: ${orgId}`);
            const report = await this.runReconciliation(orgId);
            if (report.issuesDetected > 0) {
              console.warn(`[Reconciliation] Detected ${report.issuesDetected} issues for org: ${orgId}`);
              const criticalIssues = report.issues.filter(i => i.severity === 'critical');
              if (criticalIssues.length > 0) {
                console.error(`[Reconciliation] CRITICAL: ${criticalIssues.length} critical issues detected:`, criticalIssues.map(i => ({ type: i.type, message: i.message })));
              }
            }
          }
        }
      } catch (error) {
        console.error('[Reconciliation] Scheduled run failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

export const dataReconciliationService = new DataReconciliationService();
console.log('[DataReconciliation] Service initialized');
