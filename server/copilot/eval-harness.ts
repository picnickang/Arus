/**
 * Wave 3.4 — Copilot eval harness.
 *
 * Runs a golden-question fixture through an injected copilot callable
 * and scores the result against expected tool calls / answer shape.
 * The harness is dependency-free and DOES NOT call OpenAI itself —
 * the caller injects a `CopilotCallable` (in CI, a mocked one; in a
 * staging job, a real one). That keeps unit tests deterministic and
 * free, and keeps live-API runs explicit and rate-limited.
 *
 * Output is JSON-shaped so CI can diff against a baseline and gate
 * merges on regression (tool-call accuracy, hallucination rate,
 * latency p50, average tokens) per the gap plan.
 */

export interface CopilotToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface CopilotResponse {
  /** Final assistant text returned to the user. */
  text: string;
  /** Tool calls the model made during the turn, in order. */
  toolCalls: CopilotToolCall[];
  /** Token usage from the provider (optional). */
  tokens?: { prompt: number; completion: number };
  /** Wall-clock latency of the turn in milliseconds. */
  latencyMs: number;
}

export type CopilotCallable = (question: string) => Promise<CopilotResponse>;

export interface GoldenQuestion {
  /** Stable identifier — used as the row key in baseline diffs. */
  id: string;
  /** The user question to evaluate against. */
  question: string;
  /** Tool names the model is expected to call (order matters). */
  expectedTools: string[];
  /** Substrings the answer must contain (case-insensitive). */
  expectedContains?: string[];
  /** Substrings the answer must NOT contain — hallucination guards. */
  mustNotContain?: string[];
  /** Optional tag for grouping in CI reports. */
  tags?: string[];
}

export interface QuestionResult {
  id: string;
  passed: boolean;
  toolCallAccuracy: number;      // 0..1, ordered prefix match
  containsScore: number;         // 0..1, fraction of expectedContains hit
  hallucinationFlag: boolean;    // true if any mustNotContain present
  latencyMs: number;
  tokens?: { prompt: number; completion: number };
  failures: string[];
}

export interface EvalReport {
  totalQuestions: number;
  passed: number;
  failed: number;
  toolCallAccuracy: number;      // mean across questions
  hallucinationRate: number;     // share with hallucinationFlag = true
  latencyP50Ms: number;
  latencyP95Ms: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  results: QuestionResult[];
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor((p / 100) * sortedAsc.length)));
  return sortedAsc[idx]!;
}

function orderedPrefixAccuracy(expected: string[], actual: string[]): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0;
  let hits = 0;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] && actual[i] === expected[i]) hits++;
    else break;
  }
  return hits / expected.length;
}

function evaluateOne(
  q: GoldenQuestion,
  resp: CopilotResponse
): QuestionResult {
  const failures: string[] = [];

  const actualToolNames = resp.toolCalls.map((c) => c.name);
  const toolCallAccuracy = orderedPrefixAccuracy(q.expectedTools, actualToolNames);
  if (toolCallAccuracy < 1) {
    failures.push(
      `tool-call mismatch: expected [${q.expectedTools.join(", ")}], got [${actualToolNames.join(", ")}]`
    );
  }

  const haystack = resp.text.toLowerCase();
  let containsScore = 1;
  if (q.expectedContains?.length) {
    const hits = q.expectedContains.filter((s) => haystack.includes(s.toLowerCase())).length;
    containsScore = hits / q.expectedContains.length;
    if (containsScore < 1) {
      const missed = q.expectedContains.filter((s) => !haystack.includes(s.toLowerCase()));
      failures.push(`missing required substrings: ${JSON.stringify(missed)}`);
    }
  }

  const hallucinationHits = (q.mustNotContain ?? []).filter((s) =>
    haystack.includes(s.toLowerCase())
  );
  const hallucinationFlag = hallucinationHits.length > 0;
  if (hallucinationFlag) {
    failures.push(`forbidden substrings present: ${JSON.stringify(hallucinationHits)}`);
  }

  return {
    id: q.id,
    passed: failures.length === 0,
    toolCallAccuracy,
    containsScore,
    hallucinationFlag,
    latencyMs: resp.latencyMs,
    tokens: resp.tokens,
    failures,
  };
}

/**
 * Run the full golden set through `call` and produce a scored report.
 * Caller controls concurrency by passing the callable they want —
 * we deliberately do not parallelize here because OpenAI's rate
 * limits are per-org and the harness is the wrong place to manage
 * them. Wrap `call` with a limiter at the boundary if needed.
 */
export async function runCopilotEval(
  questions: readonly GoldenQuestion[],
  call: CopilotCallable
): Promise<EvalReport> {
  const results: QuestionResult[] = [];
  for (const q of questions) {
    let resp: CopilotResponse;
    try {
      resp = await call(q.question);
    } catch (err) {
      results.push({
        id: q.id,
        passed: false,
        toolCallAccuracy: 0,
        containsScore: 0,
        hallucinationFlag: false,
        latencyMs: 0,
        failures: [`callable threw: ${err instanceof Error ? err.message : String(err)}`],
      });
      continue;
    }
    results.push(evaluateOne(q, resp));
  }

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const passed = results.filter((r) => r.passed).length;
  const meanAccuracy =
    results.length === 0 ? 0 : results.reduce((s, r) => s + r.toolCallAccuracy, 0) / results.length;
  const hallucinationRate =
    results.length === 0 ? 0 : results.filter((r) => r.hallucinationFlag).length / results.length;
  const totalPromptTokens = results.reduce((s, r) => s + (r.tokens?.prompt ?? 0), 0);
  const totalCompletionTokens = results.reduce((s, r) => s + (r.tokens?.completion ?? 0), 0);

  return {
    totalQuestions: results.length,
    passed,
    failed: results.length - passed,
    toolCallAccuracy: meanAccuracy,
    hallucinationRate,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    totalPromptTokens,
    totalCompletionTokens,
    results,
  };
}

/**
 * Seed golden set — small, covers each tool family the copilot
 * exposes today. Expand in `server/copilot/golden-questions.ts` as
 * more tools land. Stable IDs (`Q-###`) so baseline diffs are
 * meaningful across PRs.
 */
export const SEED_GOLDEN_QUESTIONS: readonly GoldenQuestion[] = [
  {
    id: "Q-001",
    question: "What's the current status of vessel MV Aurora?",
    expectedTools: ["get_vessel_status"],
    expectedContains: ["aurora"],
    mustNotContain: ["i don't have access"],
    tags: ["vessel", "read"],
  },
  {
    id: "Q-002",
    question: "List the top 5 equipment items by risk score across the fleet.",
    expectedTools: ["list_equipment_by_risk"],
    expectedContains: ["risk"],
    tags: ["fleet", "risk", "read"],
  },
  {
    id: "Q-003",
    question: "Show me overdue work orders for engine room equipment.",
    expectedTools: ["search_work_orders"],
    expectedContains: ["work order"],
    mustNotContain: ["all clear"],
    tags: ["work-orders", "read"],
  },
  {
    id: "Q-004",
    question: "Create a work order for ME #1 — fuel filter replacement, priority high.",
    expectedTools: ["create_work_order"],
    expectedContains: ["created"],
    mustNotContain: ["cannot create"],
    tags: ["work-orders", "write"],
  },
  {
    id: "Q-005",
    question: "Which parts are below reorder point on MV Aurora?",
    expectedTools: ["list_low_stock_parts"],
    expectedContains: ["reorder"],
    tags: ["inventory", "read"],
  },
  {
    id: "Q-006",
    question: "What's the RUL prediction for the starboard main generator?",
    expectedTools: ["get_rul_prediction"],
    expectedContains: ["rul"],
    tags: ["ml", "read"],
  },
];
