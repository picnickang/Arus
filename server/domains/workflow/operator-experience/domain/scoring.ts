import type {
  ExperienceFrictionPoint,
  ExperiencePillarScore,
  ExperienceSeverity,
  ExperienceTrustSignal,
  OperatorExperienceSignalSnapshot,
} from "./types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function severity(score: number): ExperienceSeverity {
  if (score < 45) return "critical";
  if (score < 65) return "risk";
  if (score < 82) return "watch";
  return "good";
}

function scoreCard(
  pillar: ExperiencePillarScore["pillar"],
  label: string,
  score: number,
  reason: string,
  recommendedImprovement: string
): ExperiencePillarScore {
  const normalized = Math.round(clamp(score));
  return {
    pillar,
    label,
    score: normalized,
    severity: severity(normalized),
    reason,
    recommendedImprovement,
  };
}

export function computeExperiencePillarScores(signals: OperatorExperienceSignalSnapshot): ExperiencePillarScore[] {
  const sourceFailures = Object.values(signals.sourceHealth).filter((value) => value !== "ok").length;
  const clarityScore = 92 - Math.min(signals.attentionItems, 20) * 1.5 - sourceFailures * 8;
  const trustScore = 88 - signals.dataQualityWarnings * 7 - sourceFailures * 10 - signals.conflicts * 6;
  const actionabilityScore = 90 - signals.blockedItems * 5 - signals.waitingOnParts * 3 + Math.min(signals.readyForCloseout, 4) * 2;
  const speedScore = 92 - signals.offlinePending * 2.5 - signals.conflicts * 7;
  const offlineScore = 95 - signals.conflicts * 15 - Math.max(signals.offlinePending - 10, 0) * 3;
  const learningScore = 84 + Math.min(signals.readyForCloseout, 6) * 2 - signals.pdmRisks * 0.75;

  return [
    scoreCard(
      "clarity",
      "Clarity",
      clarityScore,
      signals.attentionItems > 0
        ? `${signals.attentionItems} attention items need triage, so the interface should lead with priority and next action.`
        : "The attention queue is light and users should be able to understand the day quickly.",
      "Keep the Today panel focused on the top three operational priorities."
    ),
    scoreCard(
      "trust",
      "Trust",
      trustScore,
      sourceFailures > 0
        ? `${sourceFailures} data source(s) are degraded, which reduces trust in recommendations.`
        : "Core workflow sources are reporting normally.",
      "Show data freshness, source health, confidence, and evidence beside every recommendation."
    ),
    scoreCard(
      "actionability",
      "Actionability",
      actionabilityScore,
      signals.blockedItems > 0
        ? `${signals.blockedItems} work item(s) are blocked and need owner/ETA resolution.`
        : "Most active work appears actionable.",
      "Convert every blocker into owner, ETA, and one clear next step."
    ),
    scoreCard(
      "speed",
      "Speed & Responsiveness",
      speedScore,
      signals.offlinePending > 0
        ? `${signals.offlinePending} offline operation(s) are waiting to sync.`
        : "No major sync backlog is visible.",
      "Keep loading states, retry controls, and offline-save confirmations visible."
    ),
    scoreCard(
      "offline_resilience",
      "Offline Resilience",
      offlineScore,
      signals.conflicts > 0
        ? `${signals.conflicts} sync conflict(s) need resolution before users can fully trust offline work.`
        : "No unresolved offline conflict is visible.",
      "Surface an Offline Outbox link whenever pending/conflicted changes exist."
    ),
    scoreCard(
      "learning_loop",
      "PdM Learning Loop",
      learningScore,
      signals.readyForCloseout > 0
        ? `${signals.readyForCloseout} work order(s) can feed closeout evidence back into PdM learning.`
        : "There are no obvious closeout opportunities feeding the learning loop right now.",
      "Ask for prediction correctness, failure mode, downtime avoided, and parts used at closeout."
    ),
  ];
}

export function identifyFrictionPoints(signals: OperatorExperienceSignalSnapshot): ExperienceFrictionPoint[] {
  const points: ExperienceFrictionPoint[] = [];

  if (signals.blockedItems > 0) {
    points.push({
      id: "blocked-work",
      title: "Blocked work needs clearer ownership",
      symptom: `${signals.blockedItems} item(s) are blocked by parts, approvals, vendors, or missing information.`,
      affectedGoal: "Turn maintenance risk into action without losing time.",
      fix: "Require blocker owner, ETA, and resolution path directly from the Attention Inbox.",
      priority: signals.blockedItems >= 3 ? "critical" : "high",
    });
  }

  if (signals.conflicts > 0) {
    points.push({
      id: "offline-conflicts",
      title: "Offline conflicts may reduce user trust",
      symptom: `${signals.conflicts} queued change(s) need conflict resolution.`,
      affectedGoal: "Make vessel users confident that disconnected work is safe.",
      fix: "Offer Keep Local, Use Server, Merge, Retry, and Discard actions in the Offline Outbox.",
      priority: "critical",
    });
  }

  if (signals.dataQualityWarnings > 0) {
    points.push({
      id: "data-quality",
      title: "Prediction trust depends on data freshness",
      symptom: `${signals.dataQualityWarnings} data-quality warning(s) are visible in the operating picture.`,
      affectedGoal: "Help engineers trust PdM recommendations.",
      fix: "Place freshness, sample count, and confidence near every PdM recommendation.",
      priority: "high",
    });
  }

  if (signals.readyForCloseout > 0) {
    points.push({
      id: "closeout-loop",
      title: "Closeout is the best chance to improve PdM learning",
      symptom: `${signals.readyForCloseout} item(s) are ready for verification or closeout.`,
      affectedGoal: "Capture proof, root cause, and prediction feedback.",
      fix: "Use guided closeout with labour, downtime, parts, root cause, evidence, and PdM feedback.",
      priority: "medium",
    });
  }

  if (points.length === 0) {
    points.push({
      id: "continuous-optimization",
      title: "Keep the workflow simple and measurable",
      symptom: "No major workflow blockers are visible right now.",
      affectedGoal: "Maintain clarity, trust, retention, and daily completion rates.",
      fix: "Keep measuring attention-item completion, handover acknowledgement, and closeout feedback quality.",
      priority: "low",
    });
  }

  return points;
}

export function buildTrustSignals(signals: OperatorExperienceSignalSnapshot): ExperienceTrustSignal[] {
  const sourceFailures = Object.values(signals.sourceHealth).filter((value) => value !== "ok").length;
  return [
    {
      id: "source-health",
      label: "Source health",
      description: "Users know whether recommendations are based on healthy work-order, alert, equipment, and inventory sources.",
      status: sourceFailures === 0 ? "present" : "needs_attention",
      evidence: sourceFailures === 0 ? "All workflow source adapters responded." : `${sourceFailures} source adapter(s) reported degraded status.`,
    },
    {
      id: "offline-state",
      label: "Offline state",
      description: "Disconnected work is visible and recoverable instead of silently failing.",
      status: signals.conflicts > 0 ? "needs_attention" : "present",
      evidence: signals.offlinePending > 0 ? `${signals.offlinePending} change(s) pending sync.` : "No pending offline changes are visible.",
    },
    {
      id: "handover-context",
      label: "Handover continuity",
      description: "Open risks and blocked work can be carried into the next watch.",
      status: signals.handoverNotes > 0 || signals.attentionItems > 0 ? "present" : "needs_attention",
      evidence: signals.handoverNotes > 0 ? `${signals.handoverNotes} handover note(s) available.` : "No recent handover note is visible.",
    },
    {
      id: "pdm-evidence",
      label: "PdM evidence",
      description: "Predictions are paired with confidence, data quality, and operational context.",
      status: signals.dataQualityWarnings > 0 ? "needs_attention" : "present",
      evidence: signals.dataQualityWarnings > 0 ? `${signals.dataQualityWarnings} data warning(s) require review.` : "No PdM data-quality warning is visible.",
    },
  ];
}
