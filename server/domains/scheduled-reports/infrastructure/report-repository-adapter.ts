/**
 * Report Repository Adapter
 * Database persistence for report schedules and generated reports
 */

import { v4 as uuidv4 } from "uuid";
import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import type { IReportScheduleRepository, IGeneratedReportRepository } from "../domain/ports.js";
import type {
  ReportScheduleConfig,
  ReportScheduleInput,
  GeneratedReport,
  ReportType,
  ReportFrequency,
  ReportFormat,
  ReportStatus,
} from "../domain/types.js";

export class ReportScheduleRepositoryAdapter implements IReportScheduleRepository {
  async create(
    orgId: string,
    input: ReportScheduleInput,
    createdBy: string
  ): Promise<ReportScheduleConfig> {
    const id = uuidv4();
    const now = new Date();
    const nextRunAt = this.calculateNextRun(input.cronExpression || "0 8 * * *");

    const record = {
      id,
      orgId,
      name: input.name,
      reportType: input.reportType,
      frequency: input.frequency,
      cronExpression: input.cronExpression || "0 8 * * *",
      timezone: input.timezone || "UTC",
      format: input.format || "pdf",
      recipients: input.recipients,
      vesselIds: input.vesselIds || null,
      enabled: input.enabled !== false,
      lastRunAt: null,
      nextRunAt,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await db.execute(sql`
      INSERT INTO report_schedules (
        id, org_id, name, report_type, frequency, cron_expression,
        timezone, format, recipients, vessel_ids, enabled,
        last_run_at, next_run_at, created_by, created_at, updated_at
      ) VALUES (
        ${record.id}, ${record.orgId}, ${record.name}, ${record.reportType},
        ${record.frequency}, ${record.cronExpression}, ${record.timezone},
        ${record.format}, ${JSON.stringify(record.recipients)},
        ${record.vesselIds ? JSON.stringify(record.vesselIds) : null},
        ${record.enabled}, ${record.lastRunAt}, ${record.nextRunAt},
        ${record.createdBy}, ${record.createdAt}, ${record.updatedAt}
      )
    `);

    return record;
  }

  async update(
    id: string,
    orgId: string,
    input: Partial<ReportScheduleInput>
  ): Promise<ReportScheduleConfig> {
    const existing = await this.findById(id, orgId);
    if (!existing) {
      throw new Error(`Schedule not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };

    if (input.cronExpression) {
      updated.nextRunAt = this.calculateNextRun(input.cronExpression);
    }

    await db.execute(sql`
      UPDATE report_schedules SET
        name = ${updated.name},
        report_type = ${updated.reportType},
        frequency = ${updated.frequency},
        cron_expression = ${updated.cronExpression},
        timezone = ${updated.timezone},
        format = ${updated.format},
        recipients = ${JSON.stringify(updated.recipients)},
        vessel_ids = ${updated.vesselIds ? JSON.stringify(updated.vesselIds) : null},
        enabled = ${updated.enabled},
        next_run_at = ${updated.nextRunAt},
        updated_at = ${updated.updatedAt}
      WHERE id = ${id} AND org_id = ${orgId}
    `);

    return updated;
  }

  async delete(id: string, orgId: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM report_schedules WHERE id = ${id} AND org_id = ${orgId}
    `);
  }

  async findById(id: string, orgId: string): Promise<ReportScheduleConfig | null> {
    const result = await db.execute(sql`
      SELECT * FROM report_schedules WHERE id = ${id} AND org_id = ${orgId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return this.mapRowToConfig(result.rows[0]);
  }

  async findByOrg(orgId: string): Promise<ReportScheduleConfig[]> {
    const result = await db.execute(sql`
      SELECT * FROM report_schedules WHERE org_id = ${orgId} ORDER BY created_at DESC
    `);

    if (!result.rows) {
      return [];
    }
    return result.rows.map((row: unknown) => this.mapRowToConfig(row));
  }

  async findDueSchedules(now: Date): Promise<ReportScheduleConfig[]> {
    const result = await db.execute(sql`
      SELECT * FROM report_schedules
      WHERE enabled = true
      ORDER BY next_run_at ASC
    `);

    if (!result.rows) {
      return [];
    }
    return result.rows.map((row: unknown) => this.mapRowToConfig(row));
  }

  async updateLastRun(id: string, runAt: Date, nextRunAt: Date): Promise<void> {
    await db.execute(sql`
      UPDATE report_schedules SET
        last_run_at = ${runAt},
        next_run_at = ${nextRunAt},
        updated_at = ${new Date()}
      WHERE id = ${id}
    `);
  }

  private mapRowToConfig(row: any): ReportScheduleConfig {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      reportType: row.report_type as ReportType,
      frequency: row.frequency as ReportFrequency,
      cronExpression: row.cron_expression,
      timezone: row.timezone,
      format: row.format as ReportFormat,
      recipients: typeof row.recipients === "string" ? JSON.parse(row.recipients) : row.recipients,
      vesselIds: row.vessel_ids
        ? typeof row.vessel_ids === "string"
          ? JSON.parse(row.vessel_ids)
          : row.vessel_ids
        : null,
      enabled: Boolean(row.enabled),
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : null,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private calculateNextRun(cronExpression: string): Date {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(8, 0, 0, 0);
    return next;
  }
}

export class GeneratedReportRepositoryAdapter implements IGeneratedReportRepository {
  async create(report: Omit<GeneratedReport, "id">): Promise<GeneratedReport> {
    const id = uuidv4();
    const record = { id, ...report };

    await db.execute(sql`
      INSERT INTO generated_reports (
        id, schedule_id, org_id, report_type, format, filename,
        file_path, file_size, status, generated_at, delivered_at,
        expires_at, metadata, error_message
      ) VALUES (
        ${record.id}, ${record.scheduleId}, ${record.orgId}, ${record.reportType},
        ${record.format}, ${record.filename}, ${record.filePath}, ${record.fileSize},
        ${record.status}, ${record.generatedAt}, ${record.deliveredAt},
        ${record.expiresAt}, ${JSON.stringify(record.metadata)}, ${record.errorMessage}
      )
    `);

    return record;
  }

  async update(id: string, updates: Partial<GeneratedReport>): Promise<GeneratedReport> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      setClauses.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.deliveredAt !== undefined) {
      setClauses.push(`delivered_at = $${values.length + 1}`);
      values.push(updates.deliveredAt);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${values.length + 1}`);
      values.push(updates.errorMessage);
    }

    if (setClauses.length > 0) {
      await db.execute(sql`
        UPDATE generated_reports SET
          status = COALESCE(${updates.status}, status),
          delivered_at = COALESCE(${updates.deliveredAt}, delivered_at),
          error_message = COALESCE(${updates.errorMessage}, error_message)
        WHERE id = ${id}
      `);
    }

    const result = await db.execute(sql`
      SELECT * FROM generated_reports WHERE id = ${id}
    `);

    return this.mapRowToReport(result.rows[0]);
  }

  async findById(id: string, orgId: string): Promise<GeneratedReport | null> {
    const result = await db.execute(sql`
      SELECT * FROM generated_reports WHERE id = ${id} AND org_id = ${orgId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return this.mapRowToReport(result.rows[0]);
  }

  async findBySchedule(scheduleId: string, orgId: string, limit = 10): Promise<GeneratedReport[]> {
    const result = await db.execute(sql`
      SELECT * FROM generated_reports
      WHERE schedule_id = ${scheduleId} AND org_id = ${orgId}
      ORDER BY generated_at DESC
      LIMIT ${limit}
    `);

    if (!result.rows) {
      return [];
    }
    return result.rows.map((row: unknown) => this.mapRowToReport(row));
  }

  async findByOrg(orgId: string, limit = 50): Promise<GeneratedReport[]> {
    const result = await db.execute(sql`
      SELECT * FROM generated_reports
      WHERE org_id = ${orgId}
      ORDER BY generated_at DESC
      LIMIT ${limit}
    `);

    if (!result.rows) {
      return [];
    }
    return result.rows.map((row: unknown) => this.mapRowToReport(row));
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await db.execute(sql`
      DELETE FROM generated_reports WHERE expires_at < ${now}
    `);

    return (result as any).rowCount || 0;
  }

  private mapRowToReport(row: any): GeneratedReport {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      orgId: row.org_id,
      reportType: row.report_type as ReportType,
      format: row.format as ReportFormat,
      filename: row.filename,
      filePath: row.file_path,
      fileSize: row.file_size,
      status: row.status as ReportStatus,
      generatedAt: new Date(row.generated_at),
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
      expiresAt: new Date(row.expires_at),
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      errorMessage: row.error_message,
    };
  }
}
