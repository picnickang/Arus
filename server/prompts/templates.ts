/**
 * Seed prompts for the Wave 3.5 registry.
 *
 * Each prompt is immutable once shipped. Wording changes require a new
 * semver-bumped entry; old refs must keep resolving for audit log
 * reproducibility.
 */

import type { PromptDefinition } from "./registry";

export const SEED_PROMPTS: readonly PromptDefinition[] = [
  {
    id: "risk-narrative",
    version: "1.0.0",
    description:
      "Generates a one-paragraph executive risk narrative for an at-risk equipment item.",
    owner: "ml-platform",
    template: [
      "You are a marine reliability engineer briefing a Chief Engineer.",
      "Equipment: {{equipmentName}} on {{vesselName}}.",
      "Current PdM risk score: {{riskScore}} (0-100, higher = worse).",
      "Top contributing signals: {{topSignals}}.",
      "Write a single-paragraph executive narrative (max 80 words) explaining",
      "what the risk is, why it matters operationally, and the single most",
      "important next action. Avoid hedging language.",
    ].join("\n"),
    variables: ["equipmentName", "vesselName", "riskScore", "topSignals"],
    defaults: { model: "gpt-4o-mini", temperature: 0.2, maxTokens: 200 },
  },
  {
    id: "fleet-daily-briefing",
    version: "1.0.0",
    description: "Daily fleet operations briefing for shift-start.",
    owner: "fleet-ops",
    template: [
      "Generate a concise daily operations briefing for a fleet manager.",
      "Vessels in scope: {{vesselCount}}.",
      "Open critical alerts: {{criticalAlerts}}.",
      "Overdue work orders: {{overdueWO}}.",
      "CII compliance status: {{ciiStatus}}.",
      "Output 3 short bullets: (1) what changed overnight, (2) the single highest",
      "priority for the next 8 hours, (3) any compliance items needing today.",
      "Max 120 words total. No emojis.",
    ].join("\n"),
    variables: ["vesselCount", "criticalAlerts", "overdueWO", "ciiStatus"],
    defaults: { model: "gpt-4o-mini", temperature: 0.3, maxTokens: 250 },
  },
  {
    id: "wo-cause-suggestion",
    version: "1.0.0",
    description:
      "Suggests probable cause for a completed work order based on the closeout payload.",
    owner: "maintenance",
    template: [
      "You are an ISO 14224 failure-mode classifier.",
      "Work performed: {{workPerformed}}.",
      "Parts replaced: {{partsUsed}}.",
      "Symptoms reported: {{symptoms}}.",
      "Propose the most likely failure mechanism in 1 sentence and",
      "suggest one ISO 14224 failure-mode code. Output JSON:",
      '{"mechanism": "...", "iso14224Code": "..."}',
    ].join("\n"),
    variables: ["workPerformed", "partsUsed", "symptoms"],
    defaults: { model: "gpt-4o-mini", temperature: 0.1, maxTokens: 150 },
  },
];
