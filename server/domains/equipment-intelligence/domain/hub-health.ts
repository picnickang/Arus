/**
 * Honest health derivation: when no PdM score row exists the hub must say
 * so (null) rather than fabricate health=100 / confidence=85% / RUL=365 —
 * the same fake-healthy failure mode the density audit's trust phase
 * removed elsewhere.
 */
export function deriveHubHealthFields(
  healthIdx: number | null,
  pred: { remainingUsefulLife?: number | null; failureProbability?: number | null } | null
): { health: number | null; rul: number | null; confidence: number | null } {
  return {
    health: healthIdx,
    rul: pred?.remainingUsefulLife ?? null,
    confidence:
      pred?.failureProbability == null ? null : Math.round(pred.failureProbability * 100),
  };
}
