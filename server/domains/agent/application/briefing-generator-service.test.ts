import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { LLMChatParams, LLMChatResponse } from "../../../lib/llm-gateway/types";

const chatMock = jest.fn<(params: LLMChatParams) => Promise<LLMChatResponse>>();

function makeChatResponse(content: string): LLMChatResponse {
  return {
    content,
    toolCalls: [],
    finishReason: "stop",
    model: "gpt-4o-mini",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    provider: "test",
    latencyMs: 0,
    raw: null,
  };
}

jest.unstable_mockModule("../../../composition/llm-gateway", () => ({
  llmGateway: {
    chat: chatMock,
  },
}));

const { BriefingGeneratorService } = await import("./briefing-generator-service");

function makeBriefing(overrides: Record<string, unknown> = {}) {
  return {
    id: "briefing-1",
    orgId: "org-1",
    generatedAt: new Date("2026-06-09T00:00:00.000Z"),
    periodStart: new Date("2026-06-08T00:00:00.000Z"),
    periodEnd: new Date("2026-06-09T00:00:00.000Z"),
    sections: [],
    status: "generating",
    scheduleRunId: null,
    aiSummary: null,
    createdAt: new Date("2026-06-09T00:00:00.000Z"),
    updatedAt: new Date("2026-06-09T00:00:00.000Z"),
    ...overrides,
  } as never;
}

function makeBriefingRepo() {
  return {
    create: jest.fn(async (data: Record<string, unknown>) => makeBriefing(data)),
    getById: jest.fn(),
    getLatestForToday: jest.fn(),
    list: jest.fn(),
    listByDate: jest.fn(),
    update: jest.fn(async (id: string, data: Record<string, unknown>) =>
      makeBriefing({ id, ...data })
    ),
  };
}

function makeAgentRepo() {
  return {
    conversations: {},
    messages: {},
    toolCalls: {},
    approvals: {},
    config: {},
    schedules: {},
    drafts: {
      list: jest.fn(async () => [
        {
          id: "draft-1",
          title: "Review safety bulletin",
          draftType: "safety_bulletin",
        },
      ]),
    },
    suggestions: {
      list: jest.fn(async (_orgId: string, status?: string, limit?: number) => {
        if (status === "pending" && limit === 10) {
          return [
            {
              id: "suggestion-1",
              title: "Inspect fire pump",
              summary: "Elevated vibration trend needs engineering review.",
              severity: "critical",
              entityType: "equipment",
              entityId: "eq-fire-pump",
            },
          ];
        }

        return [
          {
            id: "health-1",
            title: "Main engine risk increased",
            summary: "Prediction confidence crossed the high-risk threshold.",
            severity: "warning",
            entityType: "equipment",
            entityId: "eq-main-engine",
            triggerType: "high_risk_prediction",
            createdAt: new Date(),
          },
          {
            id: "old-health",
            title: "Old finding",
            summary: "Outside the 24 hour window.",
            severity: "warning",
            entityType: "equipment",
            entityId: "eq-old",
            triggerType: "critical_alert",
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          },
        ];
      }),
    },
  };
}

function makeDataPort(overrides: Record<string, unknown> = {}) {
  return {
    getOvernightAlerts: jest.fn(async () => [
      {
        id: "alert-1",
        equipmentId: "eq-main-engine",
        sensorType: "oil_pressure",
        alertType: "critical",
        message: null,
        value: 21,
        threshold: 30,
        createdAt: new Date(),
      },
    ]),
    getMaintenanceDueToday: jest.fn(async () => [
      {
        id: "maint-1",
        equipmentId: "eq-fire-pump",
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        maintenanceType: "PM",
        description: null,
      },
    ]),
    getExpiringCertifications: jest.fn(async () => [
      {
        certId: "cert-1",
        crewId: "crew-1",
        cert: "STCW Basic Safety",
        crewName: "A. Seafarer",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    ]),
    getLowStockParts: jest.fn(async () => [
      {
        id: "part-1",
        partName: "Oil Filter",
        quantityOnHand: 0,
        minStockLevel: 4,
      },
    ]),
    ...overrides,
  };
}

describe("BriefingGeneratorService", () => {
  beforeEach(() => {
    chatMock.mockReset();
    chatMock.mockResolvedValue(makeChatResponse("LLM shift summary."));
  });

  it("collects operational sections, persists a ready briefing, and asks the LLM for a summary", async () => {
    const briefingRepo = makeBriefingRepo();
    const agentRepo = makeAgentRepo();
    const dataPort = makeDataPort();
    const service = new BriefingGeneratorService(
      briefingRepo as never,
      agentRepo as never,
      dataPort as never
    );

    const result = await service.generate("org-1", "schedule-run-1");

    expect(briefingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        status: "generating",
        scheduleRunId: "schedule-run-1",
      })
    );
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        meta: { caller: "agent-briefing-summary" },
      })
    );
    expect(briefingRepo.update).toHaveBeenCalledWith(
      "briefing-1",
      expect.objectContaining({
        aiSummary: "LLM shift summary.",
        status: "ready",
      })
    );

    const updatePayload = briefingRepo.update.mock.calls[0]?.[1] as {
      sections: Array<{ key: string; items: Array<{ severity?: string; title: string }> }>;
    };
    expect(updatePayload.sections.map((section) => section.key)).toEqual([
      "overnight_alerts",
      "pending_approvals",
      "maintenance_due",
      "expiring_certifications",
      "low_stock",
      "equipment_health",
    ]);
    expect(
      updatePayload.sections.find((section) => section.key === "overnight_alerts")?.items[0]
    ).toEqual(expect.objectContaining({ severity: "critical", entityId: "eq-main-engine" }));
    expect(updatePayload.sections.find((section) => section.key === "low_stock")?.items[0]).toEqual(
      expect.objectContaining({ severity: "critical", title: "Oil Filter" })
    );
    expect(result.status).toBe("ready");
  });

  it("uses the deterministic all-clear summary without calling the LLM when every section is empty", async () => {
    const briefingRepo = makeBriefingRepo();
    const agentRepo = makeAgentRepo();
    agentRepo.drafts.list.mockResolvedValue([]);
    agentRepo.suggestions.list.mockResolvedValue([]);
    const dataPort = makeDataPort({
      getOvernightAlerts: jest.fn(async () => []),
      getMaintenanceDueToday: jest.fn(async () => []),
      getExpiringCertifications: jest.fn(async () => []),
      getLowStockParts: jest.fn(async () => []),
    });
    const service = new BriefingGeneratorService(
      briefingRepo as never,
      agentRepo as never,
      dataPort as never
    );

    await service.generate("org-1");

    expect(chatMock).not.toHaveBeenCalled();
    expect(briefingRepo.update).toHaveBeenCalledWith(
      "briefing-1",
      expect.objectContaining({
        aiSummary: expect.stringContaining("All clear"),
        status: "ready",
      })
    );
  });

  it("keeps generation ready with empty failed sections and falls back when the LLM fails", async () => {
    chatMock.mockRejectedValue(new Error("llm offline"));
    const briefingRepo = makeBriefingRepo();
    const agentRepo = makeAgentRepo();
    const dataPort = makeDataPort({
      getOvernightAlerts: jest.fn(async () => {
        throw new Error("alert source unavailable");
      }),
    });
    const service = new BriefingGeneratorService(
      briefingRepo as never,
      agentRepo as never,
      dataPort as never
    );

    await service.generate("org-1");

    const updatePayload = briefingRepo.update.mock.calls[0]?.[1] as {
      aiSummary: string;
      sections: Array<{ key: string; items: unknown[] }>;
      status: string;
    };
    expect(updatePayload.status).toBe("ready");
    expect(updatePayload.aiSummary).toContain("critical item(s) require immediate attention");
    expect(
      updatePayload.sections.find((section) => section.key === "overnight_alerts")?.items
    ).toEqual([]);
  });

  it("marks the briefing failed when final persistence fails after the placeholder is created", async () => {
    const briefingRepo = makeBriefingRepo();
    briefingRepo.update
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce(makeBriefing({ status: "failed" }));
    const agentRepo = makeAgentRepo();
    const dataPort = makeDataPort();
    const service = new BriefingGeneratorService(
      briefingRepo as never,
      agentRepo as never,
      dataPort as never
    );

    await expect(service.generate("org-1")).rejects.toThrow("write failed");

    expect(briefingRepo.update).toHaveBeenNthCalledWith(
      2,
      "briefing-1",
      expect.objectContaining({
        status: "failed",
        aiSummary: "Generation failed: write failed",
      })
    );
  });
});
