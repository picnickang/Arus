import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  AttentionWorkflowService,
  createAttentionWorkflowService,
  type IssueReportRecord,
} from "./attention-service.js";
import type { AttentionWorkflowSources } from "../domain/ports.js";

const orgId = "org-attention";
let workflowDataDir = "";

function stateFile(): string {
  return path.join(workflowDataDir, "attention-workflow-state.json");
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function sources(overrides: Partial<AttentionWorkflowSources> = {}): AttentionWorkflowSources {
  return {
    alerts: {
      getAlertNotifications: async () => [
        { id: "alert-1", title: "Bilge high level" },
        { id: "alert-2", title: "Fire loop fault" },
        { id: "alert-3", title: "Hydraulic pressure" },
        { id: "alert-4", title: "Generator temperature" },
      ],
    },
    workOrders: {
      getWorkOrders: async () => [
        {
          id: "wo-overdue",
          title: "Overdue purifier service",
          equipmentName: "Purifier",
          status: "open",
          priority: "urgent",
          dueDate: isoDaysFromNow(-2),
          assignedToName: "Chief Engineer",
        },
        {
          id: "wo-parts",
          description: "Replace cooling pump seal",
          equipment: { name: "Cooling Pump" },
          status: "in_progress",
          priority: 2,
          dueDate: isoDaysFromNow(3),
          blockedReason: "Waiting on parts from inventory",
        },
        {
          id: "wo-vendor",
          title: "Service crane hydraulic leak",
          equipmentId: "crane-1",
          status: "open",
          dueDate: isoDaysFromNow(2),
          blockedReason: "Vendor attendance required",
          assignedCrewId: "crew-1",
        },
        {
          id: "wo-today",
          title: "Due today safety rounds",
          equipmentName: "Main deck",
          status: "open",
          priority: "high",
          dueDate: isoDaysFromNow(0),
        },
        {
          id: "wo-review",
          title: "Verify generator closeout",
          equipmentName: "Generator",
          status: "ready_for_review",
          dueDate: isoDaysFromNow(1),
        },
        {
          id: "wo-complete",
          title: "Completed lube oil sample",
          equipmentName: "Main Engine",
          status: "completed",
          dueDate: isoDaysFromNow(-1),
        },
      ],
    },
    equipment: {
      getEquipmentRegistry: async () => [
        { id: "eq-critical", name: "Port Main Engine", riskLevel: "critical" },
        { equipmentId: "eq-high", name: "Bow Thruster", risk: "high" },
        { id: "eq-ok", name: "Fresh Water Pump", riskLevel: "low" },
      ],
    },
    inventory: {
      getLowStockParts: async () => [
        { id: "part-1", name: "Pump seal kit" },
        { partId: "part-2", partNo: "FILTER-01" },
      ],
    },
    ...overrides,
  };
}

describe("AttentionWorkflowService", () => {
  beforeEach(async () => {
    workflowDataDir = await mkdtemp(path.join(tmpdir(), "arus-attention-workflow-"));
    process.env["ARUS_WORKFLOW_DATA_DIR"] = workflowDataDir;
  });

  afterEach(async () => {
    delete process.env["ARUS_WORKFLOW_DATA_DIR"];
    await rm(workflowDataDir, { recursive: true, force: true });
  });

  it("aggregates alerts, work orders, equipment risk, inventory, queues, and source health", async () => {
    const service = createAttentionWorkflowService(sources());

    const workflow = await service.getWorkflow(orgId);

    expect(workflow.sources).toMatchObject({
      alerts: "ok",
      workOrders: "ok",
      equipment: "ok",
      inventory: "ok",
    });
    expect(workflow.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "alerts-unacknowledged",
        "equipment-risk-eq-critical",
        "equipment-risk-eq-high",
        "wo-overdue-wo-overdue",
        "wo-blocked-wo-parts",
        "wo-blocked-wo-vendor",
        "wo-due-today-wo-today",
        "wo-closeout-wo-review",
        "low-stock-part-1",
        "low-stock-part-2",
      ])
    );
    expect(workflow.items[0].severity).toBe("critical");
    expect(workflow.handover).toMatchObject({
      blockedJobs: 1,
      waitingOnParts: 3,
      readyForCloseout: 1,
      openWorkOrders: 5,
      lowStockParts: 2,
    });
    expect(workflow.handover.suggestedSummary.length).toBeLessThanOrEqual(5);

    const queueById = new Map(workflow.queues.map((queue) => [queue.id, queue]));
    expect(queueById.get("needs_review")).toMatchObject({ count: 3, severity: "warning" });
    expect(queueById.get("blocked")).toMatchObject({ count: 1, severity: "critical" });
    expect(queueById.get("waiting_parts")).toMatchObject({ count: 3, severity: "warning" });
    expect(queueById.get("completed")).toMatchObject({ count: 1, severity: "success" });
    expect(queueById.get("overdue")).toMatchObject({ count: 1, severity: "critical" });
  });

  it("persists handovers, blocker resolutions, and issue reports with org scoping", async () => {
    const service = new AttentionWorkflowService(sources());

    const handover = await service.saveHandover(
      orgId,
      {
        note: "Night watch priorities",
        watchLabel: "0000-0400",
        generatedSummary: "Check blocked work",
        itemIds: Array.from({ length: 60 }, (_, index) => `item-${index}`),
        status: "shared",
      },
      "user-1"
    );
    await service.saveHandover("org-other", { note: "Other org" }, "user-2");

    expect(handover).toMatchObject({
      orgId,
      note: "Night watch priorities",
      watchLabel: "0000-0400",
      status: "shared",
      authorId: "user-1",
    });
    expect(handover.itemIds).toHaveLength(50);
    expect(await service.getLatestHandover(orgId)).toMatchObject({ id: handover.id });
    expect(await service.listHandovers(orgId)).toHaveLength(1);

    const resolution = await service.saveBlockerResolution(
      orgId,
      {
        workOrderId: "wo-parts",
        blockerType: "Parts",
        reason: "Seal kit ordered",
        owner: "Logistics",
        eta: "Tomorrow",
        status: "unblocked",
        note: "PR approved",
      },
      "user-1"
    );
    expect(resolution).toMatchObject({
      itemId: "wo-parts",
      status: "unblocked",
      owner: "Logistics",
      authorId: "user-1",
    });

    const workflow = await service.getWorkflow(orgId);
    expect(workflow.items.some((item) => item.id === "wo-blocked-wo-parts")).toBe(false);

    const reports: IssueReportRecord[] = [];
    for (const target of ["work_order", "finding", "log_note", "handover"] as const) {
      reports.push(
        await service.reportIssue(
          orgId,
          {
            severity: target === "handover" ? "critical" : "high",
            summary: `${target} issue`,
            vessel: "ARUS Trader",
            equipment: "Pump",
            location: "Engine room",
            impact: "Downtime risk",
            evidenceNote: "Photo attached",
            owner: "Chief Engineer",
            dueDate: "2026-06-10",
            target,
            status: "submitted",
          },
          "user-1"
        )
      );
    }

    expect(reports.map((report) => report.suggestedHref)).toEqual([
      expect.stringContaining("/work-orders?action=create"),
      expect.stringContaining("/findings?action=create"),
      expect.stringContaining("/logs/deck?flow=report-issue"),
      expect.stringContaining("/attention-inbox?view=handover"),
    ]);

    const raw = JSON.parse(await readFile(stateFile(), "utf8")) as {
      handovers: unknown[];
      blockerResolutions: unknown[];
      issueReports: unknown[];
    };
    expect(raw.handovers).toHaveLength(2);
    expect(raw.blockerResolutions).toHaveLength(1);
    expect(raw.issueReports).toHaveLength(4);
  });

  it("reports partial source failures without blocking the workflow page", async () => {
    const service = createAttentionWorkflowService(
      sources({
        alerts: {
          getAlertNotifications: async () => {
            throw new Error("alerts offline");
          },
        },
        equipment: {
          getEquipmentRegistry: async () => [null, "not a record"],
        },
        inventory: {
          getLowStockParts: async () => {
            throw "inventory unavailable";
          },
        },
      })
    );

    const workflow = await service.getWorkflow(orgId);

    expect(workflow.sources).toMatchObject({
      alerts: "failed",
      workOrders: "ok",
      equipment: "ok",
      inventory: "failed",
      errors: {
        alerts: "alerts offline",
        inventory: "low-stock unavailable",
      },
    });
    expect(workflow.items.some((item) => item.type === "work_order")).toBe(true);
    expect(workflow.items.some((item) => item.type === "equipment")).toBe(false);
  });

  it("normalizes invalid persistence inputs to safe defaults", async () => {
    const service = createAttentionWorkflowService(sources());

    const handover = await service.saveHandover(orgId, {
      note: 12345,
      watchLabel: "",
      generatedSummary: undefined,
      itemIds: "not-array",
      status: "nonsense",
    });
    expect(handover).toMatchObject({
      note: "12345",
      watchLabel: undefined,
      generatedSummary: "",
      itemIds: [],
      status: "draft",
    });

    const resolution = await service.saveBlockerResolution(orgId, {
      inventoryItemId: "part-1",
      status: "not-real",
    });
    expect(resolution).toMatchObject({
      itemId: "part-1",
      blockerType: "Information needed",
      reason: "No reason provided",
      status: "updated",
    });

    const issue = await service.reportIssue(orgId, {
      severity: "invalid",
      summary: "",
      target: "unknown",
      status: "draft",
    });
    expect(issue).toMatchObject({
      severity: "medium",
      summary: "Untitled issue",
      target: "work_order",
      status: "draft",
    });
    expect(issue.suggestedHref).toContain("/work-orders?action=create");
  });
});
