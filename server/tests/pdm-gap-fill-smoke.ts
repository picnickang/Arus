interface SmokeTestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export async function runPdmGapFillSmokeTests(baseUrl: string): Promise<{
  suite: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  tests: SmokeTestResult[];
  timestamp: string;
}> {
  const startTime = Date.now();
  const tests: SmokeTestResult[] = [];
  const headers = { "x-org-id": "default-org-id", "Content-Type": "application/json" };

  async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
    const testStart = Date.now();
    try {
      await fn();
      tests.push({ name, passed: true, duration: Date.now() - testStart });
    } catch (error) {
      tests.push({
        name,
        passed: false,
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await runTest("GET /api/ml/calibration/report", async () => {
    const res = await fetch(`${baseUrl}/api/ml/calibration/report`, { headers });
    if (res.status !== 200 && res.status !== 404) {
      throw new Error(`Expected 200 or 404, got ${res.status}`);
    }
  });

  await runTest("GET /api/analytics/anomaly-groups", async () => {
    const res = await fetch(`${baseUrl}/api/analytics/anomaly-groups`, { headers });
    if (res.status !== 200) {throw new Error(`Expected 200, got ${res.status}`);}
    const data = await res.json();
    if (typeof data.totalGroups !== "number") {throw new Error("Missing totalGroups in response");}
  });

  await runTest("GET /api/ml/train/jobs", async () => {
    const res = await fetch(`${baseUrl}/api/ml/train/jobs`, { headers });
    if (res.status !== 200) {throw new Error(`Expected 200, got ${res.status}`);}
    const data = await res.json();
    if (!Array.isArray(data.jobs)) {throw new Error("Missing jobs array in response");}
  });

  await runTest("GET /api/telemetry/aggregated/:id/:sensor", async () => {
    const res = await fetch(
      `${baseUrl}/api/telemetry/aggregated/test-equipment/temperature?startDate=${new Date(Date.now() - 86400000).toISOString()}&endDate=${new Date().toISOString()}`,
      { headers }
    );
    if (res.status !== 200) {throw new Error(`Expected 200, got ${res.status}`);}
  });

  await runTest("POST /api/ml/evaluate-model (validation)", async () => {
    const res = await fetch(`${baseUrl}/api/ml/evaluate-model`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (res.status !== 400) {throw new Error(`Expected 400 for missing modelId, got ${res.status}`);}
  });

  await runTest("POST /api/ml/outcomes/evaluate", async () => {
    const res = await fetch(`${baseUrl}/api/ml/outcomes/evaluate`, {
      method: "POST",
      headers,
    });
    if (res.status !== 200) {throw new Error(`Expected 200, got ${res.status}`);}
  });

  const duration = Date.now() - startTime;
  const passed = tests.filter(t => t.passed).length;

  return {
    suite: "pdm-gap-fill-smoke",
    passed,
    failed: tests.length - passed,
    total: tests.length,
    duration,
    tests,
    timestamp: new Date().toISOString(),
  };
}
