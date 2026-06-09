import { db } from "../../../db";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import {
  agentSuggestions,
  agentDrafts,
  agentScheduleRuns,
  agentSchedules,
  agentFindings,
} from "@shared/schema";
import type {
  FindingsAggregatorPort,
  UnifiedFindingItem,
  FindingsSummary,
  FindingsFilter,
  FindingsPagination,
  FindingSeverity,
  FindingStatus,
} from "../domain/findings-types";
import { optionalIsoString, toIsoString } from "./serialization";

function normalizeSeverity(val: string | null | undefined): FindingSeverity {
  if (val === "critical" || val === "warning" || val === "info") {
    return val;
  }
  return "info";
}

function normalizeStatus(val: string | null | undefined): FindingStatus {
  const valid: FindingStatus[] = [
    "pending",
    "acted",
    "dismissed",
    "deferred",
    "approved",
    "rejected",
    "completed",
    "failed",
    "running",
  ];
  if (val && valid.includes(val as FindingStatus)) {
    return val as FindingStatus;
  }
  return "pending";
}

export function createFindingsAdapter(): FindingsAggregatorPort {
  return {
    async getFindings(
      orgId: string,
      filter?: FindingsFilter,
      pagination?: FindingsPagination
    ): Promise<{ items: UnifiedFindingItem[]; total: number }> {
      const limit = pagination?.limit ?? 50;
      const offset = pagination?.offset ?? 0;

      const items: UnifiedFindingItem[] = [];

      const shouldInclude = (source: string) => !filter?.source || filter.source === source;

      if (shouldInclude("suggestion")) {
        const conditions = [eq(agentSuggestions.orgId, orgId)];
        if (filter?.status) {
          conditions.push(eq(agentSuggestions.status, filter.status));
        }
        if (filter?.severity) {
          conditions.push(eq(agentSuggestions.severity, filter.severity));
        }
        if (filter?.dateFrom) {
          conditions.push(gte(agentSuggestions.createdAt, new Date(filter.dateFrom)));
        }
        if (filter?.dateTo) {
          conditions.push(lte(agentSuggestions.createdAt, new Date(filter.dateTo)));
        }

        const suggestions = await db
          .select()
          .from(agentSuggestions)
          .where(and(...conditions))
          .orderBy(desc(agentSuggestions.createdAt));

        for (const s of suggestions) {
          items.push({
            id: `sug_${s.id}`,
            source: "suggestion",
            sourceId: s.id,
            title: s.title,
            summary: s.summary,
            severity: normalizeSeverity(s.severity),
            status: normalizeStatus(s.status),
            entityType: s.entityType,
            entityId: s.entityId,
            triggerType: s.triggerType,
            draftType: null,
            scheduleName: null,
            scheduleId: null,
            requiresAction: s.status === "pending",
            createdAt: toIsoString(s.createdAt),
            updatedAt: null,
            context: s.context as Record<string, unknown> | null,
            outcome: s.outcome ?? null,
            outcomeReason: s.outcomeReason ?? null,
            outcomeAt: optionalIsoString(s.outcomeAt),
            outcomeBy: s.outcomeBy ?? null,
          });
        }
      }

      if (shouldInclude("draft")) {
        const conditions = [eq(agentDrafts.orgId, orgId)];
        if (filter?.status) {
          conditions.push(eq(agentDrafts.status, filter.status));
        }
        if (filter?.dateFrom) {
          conditions.push(gte(agentDrafts.createdAt, new Date(filter.dateFrom)));
        }
        if (filter?.dateTo) {
          conditions.push(lte(agentDrafts.createdAt, new Date(filter.dateTo)));
        }

        const drafts = await db
          .select()
          .from(agentDrafts)
          .where(and(...conditions))
          .orderBy(desc(agentDrafts.createdAt));

        for (const d of drafts) {
          const severity: FindingSeverity = d.status === "pending" ? "warning" : "info";
          if (filter?.severity && severity !== filter.severity) {
            continue;
          }

          items.push({
            id: `draft_${d.id}`,
            source: "draft",
            sourceId: d.id,
            title: d.title,
            summary: `Draft ${d.draftType}: ${d.title}`,
            severity,
            status: normalizeStatus(d.status),
            entityType: d.draftType,
            entityId: d.resultId,
            triggerType: null,
            draftType: d.draftType,
            scheduleName: null,
            scheduleId: null,
            requiresAction: d.status === "pending",
            createdAt: toIsoString(d.createdAt),
            updatedAt: optionalIsoString(d.updatedAt),
            context: d.data as Record<string, unknown> | null,
          });
        }
      }

      if (shouldInclude("schedule_run")) {
        const scheduleList = await db
          .select()
          .from(agentSchedules)
          .where(eq(agentSchedules.orgId, orgId));
        const scheduleMap = new Map(scheduleList.map((s) => [s.id, s]));
        const scheduleIds = scheduleList.map((s) => s.id);

        if (scheduleIds.length > 0) {
          const runConditions = [
            sql`${agentScheduleRuns.scheduleId} IN (${sql.join(
              scheduleIds.map((id) => sql`${id}`),
              sql`, `
            )})`,
          ];
          if (filter?.status) {
            runConditions.push(eq(agentScheduleRuns.status, filter.status));
          }
          if (filter?.dateFrom) {
            runConditions.push(gte(agentScheduleRuns.startedAt, new Date(filter.dateFrom)));
          }
          if (filter?.dateTo) {
            runConditions.push(lte(agentScheduleRuns.startedAt, new Date(filter.dateTo)));
          }

          const runs = await db
            .select()
            .from(agentScheduleRuns)
            .where(and(...runConditions))
            .orderBy(desc(agentScheduleRuns.startedAt));

          for (const r of runs) {
            const schedule = scheduleMap.get(r.scheduleId);
            const runStatus = normalizeStatus(r.status);

            const severity: FindingSeverity =
              r.status === "failed" ? "critical" : r.status === "running" ? "warning" : "info";
            if (filter?.severity && severity !== filter.severity) {
              continue;
            }

            items.push({
              id: `run_${r.id}`,
              source: "schedule_run",
              sourceId: r.id,
              title: schedule ? `Scheduled Run: ${schedule.name}` : `Scheduled Run`,
              summary: r.error
                ? `Failed: ${r.error}`
                : r.status === "running"
                  ? "Currently running..."
                  : `Completed successfully${r.tokenUsage ? ` (${r.tokenUsage} tokens)` : ""}`,
              severity,
              status: runStatus,
              entityType: null,
              entityId: null,
              triggerType: null,
              draftType: null,
              scheduleName: schedule?.name ?? null,
              scheduleId: r.scheduleId,
              requiresAction: false,
              createdAt: toIsoString(r.startedAt),
              updatedAt: optionalIsoString(r.completedAt),
              context: r.output ? ({ output: r.output } as Record<string, unknown>) : null,
            });
          }
        }
      }

      if (shouldInclude("agent_finding")) {
        const conditions = [eq(agentFindings.orgId, orgId)];
        if (filter?.severity) {
          conditions.push(eq(agentFindings.severity, filter.severity));
        }
        if (filter?.status) {
          const statusMap: Record<string, string[]> = {
            pending: ["new"],
            acted: ["acknowledged", "actioned"],
            dismissed: ["archived"],
          };
          const mappedStatuses = statusMap[filter.status] || [filter.status];
          if (mappedStatuses.length === 1) {
            conditions.push(eq(agentFindings.status, mappedStatuses[0]!));
          } else {
            conditions.push(
              sql`${agentFindings.status} IN (${sql.join(
                mappedStatuses.map((s) => sql`${s}`),
                sql`, `
              )})`
            );
          }
        }
        if (filter?.dateFrom) {
          conditions.push(gte(agentFindings.createdAt, new Date(filter.dateFrom)));
        }
        if (filter?.dateTo) {
          conditions.push(lte(agentFindings.createdAt, new Date(filter.dateTo)));
        }

        const agentFindingRows = await db
          .select()
          .from(agentFindings)
          .where(and(...conditions))
          .orderBy(desc(agentFindings.createdAt));

        for (const f of agentFindingRows) {
          const statusMap: Record<string, FindingStatus> = {
            new: "pending",
            acknowledged: "acted",
            actioned: "acted",
            archived: "dismissed",
          };

          items.push({
            id: `af_${f.id}`,
            source: "agent_finding",
            sourceId: f.id,
            title: f.title,
            summary: f.evidenceSummary || f.recommendedAction || `${f.findingType} finding`,
            severity: normalizeSeverity(f.severity),
            status: statusMap[f.status] || normalizeStatus(f.status),
            entityType: f.entityType,
            entityId: f.entityId,
            triggerType: f.findingType,
            draftType: null,
            scheduleName: null,
            scheduleId: null,
            requiresAction: f.status === "new",
            createdAt: toIsoString(f.createdAt),
            updatedAt: optionalIsoString(f.updatedAt),
            context: f.metadata as Record<string, unknown> | null,
          });
        }
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = items.length;
      const paged = items.slice(offset, offset + limit);

      return { items: paged, total };
    },

    async getSummary(orgId: string): Promise<FindingsSummary> {
      const [pendingSuggestions] = await db
        .select({ count: count() })
        .from(agentSuggestions)
        .where(and(eq(agentSuggestions.orgId, orgId), eq(agentSuggestions.status, "pending")));

      const [pendingDrafts] = await db
        .select({ count: count() })
        .from(agentDrafts)
        .where(and(eq(agentDrafts.orgId, orgId), eq(agentDrafts.status, "pending")));

      const [totalSuggestions] = await db
        .select({ count: count() })
        .from(agentSuggestions)
        .where(eq(agentSuggestions.orgId, orgId));

      const [totalDrafts] = await db
        .select({ count: count() })
        .from(agentDrafts)
        .where(eq(agentDrafts.orgId, orgId));

      const scheduleList = await db
        .select({ id: agentSchedules.id })
        .from(agentSchedules)
        .where(eq(agentSchedules.orgId, orgId));
      const scheduleIds = scheduleList.map((s) => s.id);

      let recentFailures = 0;
      let totalRuns = 0;
      if (scheduleIds.length > 0) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [failedRuns] = await db
          .select({ count: count() })
          .from(agentScheduleRuns)
          .where(
            and(
              sql`${agentScheduleRuns.scheduleId} IN (${sql.join(
                scheduleIds.map((id) => sql`${id}`),
                sql`, `
              )})`,
              eq(agentScheduleRuns.status, "failed"),
              gte(agentScheduleRuns.startedAt, sevenDaysAgo)
            )
          );
        recentFailures = failedRuns?.count ?? 0;

        const [allRuns] = await db
          .select({ count: count() })
          .from(agentScheduleRuns)
          .where(
            sql`${agentScheduleRuns.scheduleId} IN (${sql.join(
              scheduleIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          );
        totalRuns = allRuns?.count ?? 0;
      }

      const sugCount = pendingSuggestions?.count ?? 0;
      const draftCount = pendingDrafts?.count ?? 0;

      const [totalAgentFindings] = await db
        .select({ count: count() })
        .from(agentFindings)
        .where(eq(agentFindings.orgId, orgId));
      const agentFindingsCount = totalAgentFindings?.count ?? 0;

      return {
        pendingApprovals: draftCount,
        pendingSuggestions: sugCount,
        recentFailures,
        totalFindings:
          (totalSuggestions?.count ?? 0) +
          (totalDrafts?.count ?? 0) +
          totalRuns +
          agentFindingsCount,
        agentFindings: agentFindingsCount,
      };
    },
  };
}
