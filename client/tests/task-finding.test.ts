import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = "http://localhost:5000";

async function api(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

describe("Agent Task CRUD", () => {
  let taskId: string;

  it("creates a task", async () => {
    const { status, data } = await api("POST", "/api/agent/tasks", {
      title: "Test Task - Pump investigation",
      description: "Investigate bearing vibration on pump #3",
      priority: "high",
      source: "signal",
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.status).toBe("open");
    expect(data.priority).toBe("high");
    expect(data.source).toBe("signal");
    taskId = data.id;
  });

  it("lists tasks", async () => {
    const { status, data } = await api("GET", "/api/agent/tasks");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((t: { id: string }) => t.id === taskId)).toBe(true);
  });

  it("gets task by id", async () => {
    const { status, data } = await api("GET", `/api/agent/tasks/${taskId}`);
    expect(status).toBe(200);
    expect(data.id).toBe(taskId);
    expect(data.title).toBe("Test Task - Pump investigation");
  });

  it("filters tasks by status", async () => {
    const { status, data } = await api("GET", "/api/agent/tasks?status=open");
    expect(status).toBe(200);
    expect(data.some((t: { id: string }) => t.id === taskId)).toBe(true);
  });

  it("transitions task to in_progress", async () => {
    const { status, data } = await api("PATCH", `/api/agent/tasks/${taskId}`, {
      status: "in_progress",
    });
    expect(status).toBe(200);
    expect(data.status).toBe("in_progress");
  });

  it("rejects invalid status transition", async () => {
    const { status, data } = await api("PATCH", `/api/agent/tasks/${taskId}`, {
      status: "open",
    });
    expect(status).toBe(400);
    expect(data.error).toContain("Cannot transition");
  });

  it("transitions task to completed with outcome", async () => {
    const { status, data } = await api("PATCH", `/api/agent/tasks/${taskId}`, {
      status: "completed",
      outcome: "Bearing replaced successfully",
    });
    expect(status).toBe(200);
    expect(data.status).toBe("completed");
    expect(data.outcome).toBe("Bearing replaced successfully");
    expect(data.completedAt).toBeTruthy();
  });

  it("returns 404 for non-existent task", async () => {
    const { status } = await api("GET", "/api/agent/tasks/non-existent-id");
    expect(status).toBe(404);
  });
});

describe("Agent Finding CRUD", () => {
  let taskId: string;
  let findingId: string;

  beforeAll(async () => {
    const { data } = await api("POST", "/api/agent/tasks", {
      title: "Finding Link Test Task",
      priority: "medium",
      source: "user",
    });
    taskId = data.id;
  });

  it("creates a finding linked to a task", async () => {
    const { status, data } = await api("POST", "/api/agent/finding-records", {
      title: "Anomaly - Vibration spike on bearing",
      findingType: "anomaly",
      severity: "warning",
      evidenceSummary: "Vibration 15% above threshold",
      recommendedAction: "Schedule inspection within 48h",
      taskId,
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.findingType).toBe("anomaly");
    expect(data.severity).toBe("warning");
    expect(data.status).toBe("new");
    expect(data.taskId).toBe(taskId);
    findingId = data.id;
  });

  it("lists findings", async () => {
    const { status, data } = await api("GET", "/api/agent/finding-records");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((f: { id: string }) => f.id === findingId)).toBe(true);
  });

  it("gets finding by id", async () => {
    const { status, data } = await api("GET", `/api/agent/finding-records/${findingId}`);
    expect(status).toBe(200);
    expect(data.id).toBe(findingId);
    expect(data.taskId).toBe(taskId);
  });

  it("updates finding status to acknowledged", async () => {
    const { status, data } = await api("PATCH", `/api/agent/finding-records/${findingId}`, {
      status: "acknowledged",
    });
    expect(status).toBe(200);
    expect(data.status).toBe("acknowledged");
  });

  it("updates finding status to archived", async () => {
    const { status, data } = await api("PATCH", `/api/agent/finding-records/${findingId}`, {
      status: "archived",
    });
    expect(status).toBe(200);
    expect(data.status).toBe("archived");
  });

  it("rejects invalid finding status transition (archived to new)", async () => {
    const { status, data } = await api("PATCH", `/api/agent/finding-records/${findingId}`, {
      status: "new",
    });
    expect(status).toBe(400);
    expect(data.error).toContain("Cannot transition");
  });

  it("returns 404 for non-existent finding", async () => {
    const { status } = await api("GET", "/api/agent/finding-records/non-existent-id");
    expect(status).toBe(404);
  });
});

describe("Findings Feed Integration", () => {
  let findingId: string;

  beforeAll(async () => {
    const { data } = await api("POST", "/api/agent/finding-records", {
      title: "Feed Integration Test Finding",
      findingType: "recommendation",
      severity: "info",
      evidenceSummary: "Test evidence for feed integration",
    });
    findingId = data.id;
  });

  it("shows agent findings in unified feed", async () => {
    const { status, data } = await api("GET", "/api/agent/findings?source=agent_finding");
    expect(status).toBe(200);
    expect(data.items).toBeDefined();
    const item = data.items.find((i: { sourceId: string }) => i.sourceId === findingId);
    expect(item).toBeTruthy();
    expect(item.source).toBe("agent_finding");
  });

  it("includes agent findings in summary count", async () => {
    const { status, data } = await api("GET", "/api/agent/findings/summary");
    expect(status).toBe(200);
    expect(data.agentFindings).toBeGreaterThanOrEqual(1);
    expect(data.totalFindings).toBeGreaterThanOrEqual(1);
  });

  it("maps new status to pending in feed", async () => {
    const { data } = await api("GET", "/api/agent/findings?source=agent_finding");
    const item = data.items.find((i: { sourceId: string }) => i.sourceId === findingId);
    expect(item.status).toBe("pending");
    expect(item.requiresAction).toBe(true);
  });

  it("maps acknowledged status to acted in feed", async () => {
    await api("PATCH", `/api/agent/finding-records/${findingId}`, { status: "acknowledged" });
    const { data } = await api("GET", "/api/agent/findings?source=agent_finding");
    const item = data.items.find((i: { sourceId: string }) => i.sourceId === findingId);
    expect(item.status).toBe("acted");
    expect(item.requiresAction).toBe(false);
  });
});

describe("Task Summary Counts", () => {
  it("returns task counts by status", async () => {
    const { status, data } = await api("GET", "/api/agent/tasks/summary/counts");
    expect(status).toBe(200);
    expect(typeof data).toBe("object");
  });
});

afterAll(async () => {
  const { data: findings } = await api("GET", "/api/agent/finding-records");
  for (const f of findings as { id: string; title: string }[]) {
    if (f.title.includes("Test") || f.title.includes("Feed Integration")) {
      await api("PATCH", `/api/agent/finding-records/${f.id}`, { status: "archived" });
    }
  }
});
