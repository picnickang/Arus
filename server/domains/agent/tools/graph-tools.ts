/**
 * Push A2 — Knowledge-graph Copilot tools.
 *
 * Three relationship-style tools the LLM can call:
 *   - findSimilarFailures(equipmentId) — what has historically broken
 *     on peer equipment of the same type
 *   - whatPartsForFailureMode(failureMode) — what parts were consumed
 *     when this failure was repaired
 *   - failurePropagation(equipmentId) — downstream equipment that
 *     degrades when this equipment fails (admin-curated dependencies)
 *
 * When the graph substrate is unavailable (`GRAPH_ENABLED=false` or
 * the AGE extension isn't installed), the relational fallback path
 * still answers the question via JOINs over `failure_history` /
 * `inventory_movements`. That keeps the Copilot useful in
 * dev / single-tenant deploys without AGE.
 */

import { z } from "zod";
import { registerTool } from "./registry";
import type { ToolContext } from "../domain/types";
import {
  failurePropagation as graphFailurePropagation,
  findSimilarFailures as graphFindSimilarFailures,
  isGraphAvailable,
  whatPartsForFailureMode as graphWhatPartsForFailureMode,
} from "../../../graph";
import {
  findPeerFailureModes,
  findPartsConsumedForFailureMode,
} from "../infrastructure/graph-fallback-queries";

registerTool({
  name: "findSimilarFailures",
  category: "predictions",
  riskLevel: "read",
  description:
    "Find failure modes historically observed on equipment of the same type as the given equipment. Returns the failure mode and how many times it occurred across the fleet (graph traversal; falls back to relational lookup when the knowledge graph is offline).",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Source equipment id to find peers for" },
    },
    required: ["equipmentId"],
  },
  inputSchema: z.object({ equipmentId: z.string().min(1) }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { equipmentId } = input as { equipmentId: string };
    if (isGraphAvailable()) {
      // Fall back to relational ONLY when the graph is unavailable
      // (env-gated off / extension missing). An EMPTY graph result
      // is the correct authoritative answer when the graph is up —
      // falling through to relational here would mask graph drift
      // (reviewer's sixth-pass non-blocking comment).
      const rows = await graphFindSimilarFailures(ctx.orgId, equipmentId);
      return { source: "graph", results: rows };
    }
    // Relational fallback — same business question via JOIN.
    const rows = await findPeerFailureModes(ctx.orgId, equipmentId);
    return { source: "relational", results: rows };
  },
});

registerTool({
  name: "whatPartsForFailureMode",
  category: "inventory",
  riskLevel: "read",
  description:
    "Given a failure mode LABEL (string, e.g. 'vibration', 'bearing-wear' — the canonical text stored in failure_history.failure_mode, NOT a numeric id), return the parts historically consumed when that failure was repaired, ranked by usage count. Only forward-consumption movements ('reserve'/'consume') are counted; release/return reversals are excluded. Use when answering 'what parts do I need when this failure appears?'. Accepts either `failureMode` (preferred) or `failureModeId` (alias, same string label) for compatibility with callers that name the slot by id.",
  parameters: {
    type: "object",
    properties: {
      failureMode: {
        type: "string",
        description:
          "Failure mode label (string, not numeric id) — matches failure_history.failure_mode exactly",
      },
      failureModeId: {
        type: "string",
        description:
          "Alias for `failureMode`. Same string label; provided so callers that name the slot 'id' still resolve.",
      },
    },
  },
  // Accept either spelling; require at least one. Normalised below
  // to a single `failureMode` string before the graph/relational call.
  inputSchema: z
    .object({
      failureMode: z.string().min(1).optional(),
      failureModeId: z.string().min(1).optional(),
    })
    .refine((v) => !!(v.failureMode ?? v.failureModeId), {
      message: "failureMode (or failureModeId alias) is required",
    }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { failureMode: fm, failureModeId } = input as {
      failureMode?: string;
      failureModeId?: string;
    };
    const failureMode: string = (fm ?? failureModeId) as string;
    if (isGraphAvailable()) {
      // Same fallback policy as findSimilarFailures: empty graph
      // result is authoritative when the graph is up.
      const rows = await graphWhatPartsForFailureMode(ctx.orgId, failureMode);
      return { source: "graph", results: rows };
    }
    const rows = await findPartsConsumedForFailureMode(ctx.orgId, failureMode);
    return { source: "relational", results: rows };
  },
});

registerTool({
  name: "failurePropagation",
  category: "predictions",
  riskLevel: "read",
  description:
    "Return equipment downstream of the given equipment via admin-curated dependency edges. Use when answering 'if this fails, what else degrades?'. Returns empty when no dependency graph has been curated for this tenant.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Upstream equipment id" },
      maxHops: { type: "number", description: "Max dependency hops (1-5)", minimum: 1, maximum: 5 },
    },
    required: ["equipmentId"],
  },
  inputSchema: z.object({
    equipmentId: z.string().min(1),
    maxHops: z.number().int().min(1).max(5).optional(),
  }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { equipmentId, maxHops } = input as { equipmentId: string; maxHops?: number };
    if (!isGraphAvailable()) {
      return {
        source: "relational",
        results: [],
        note: "Dependency propagation requires the knowledge graph (GRAPH_ENABLED). No relational equivalent.",
      };
    }
    const rows = await graphFailurePropagation(ctx.orgId, equipmentId, maxHops ?? 3);
    return { source: "graph", results: rows };
  },
});
