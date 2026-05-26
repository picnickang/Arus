# Runbook — AI Model Promotion / Rollback

Trigger conditions:
- Alert: `AiPromotionFailed`, `AiInferenceErrorRate`.
- Field report: predictions are obviously wrong for an equipment
  class.
- Pre-planned rollout of a new model version.

The PdM inference architecture is documented in `replit.md` under
"Push A1 — Real PdM Inference". This runbook governs the
operational endpoints `/ml/models/:id/promote` and `/rollback`.

## 1. Promote (planned)

Before promoting in prod:

1. Confirm the candidate has run in `PDM_ONNX_MODE=shadow` for
   ≥ 7 days. Inspect the shadow comparison dashboard for
   `divergence_p95 < 0.05` across all equipment types in scope.
2. Move to `PDM_ONNX_MODE=canary` for 24 h on one pilot tenant.
   Confirm `arus_ml_inference_errors_total` does not move and
   user-reported PdM decisions do not regress.
3. Promote:
   ```
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$BASE_URL/ml/models/<modelId>/promote"
   ```
4. Verify:
   - `ml_models.status = 'deployed'` for `<modelId>`.
   - `ml_models.status = 'archived'` for the previously-deployed
     version of the same `(orgId, equipmentType)`.
   - First production inference uses the new `modelVersionId`
     (visible in the prediction-lineage column).

## 2. Rollback (unplanned)

When `AiInferenceErrorRate` fires, or operators report regression:

1. **Identify the bad version.** Grafana → ML/AI dashboard, panel
   "Inference errors by model version".
2. **Roll back immediately** — do not debug first:
   ```
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$BASE_URL/ml/models/<modelId>/rollback"
   ```
   `/rollback` promotes the most recent prior `archived` row for
   the same `(orgId, equipmentType)` back to `deployed`. Inference
   resolves the active version on every call via
   `PredictionEngineService.resolveActiveVersion()` so the next
   request uses the rolled-back model — no service restart.
3. **Verify**:
   - `AiInferenceErrorRate` clears within 10 min.
   - Lineage column on new predictions reflects the rolled-back
     `modelVersionId`.

## 3. If both versions are bad

In rare cases the rollback target is also broken (e.g. dependent
feature pipeline changed). Engage the ML on-call:

1. Set `PDM_ONNX_MODE=live` with `PDM_FALLBACK_TO_HEURISTIC=1`
   (default already true — `ModelBackedInferenceRunner` wraps the
   ONNX call with a heuristic hard-failure fallback). This forces
   the heuristic baseline.
2. Open SEV-2 incident.
3. Do **not** archive both versions — leaves no rollback target.

## 4. If `/promote` itself fails

`AiPromotionFailed` fires when `arus_ml_promotion_failed_total`
increments. Likely causes:

- **Artifact missing on disk.** The `artifactPath` row in `ml_models`
  references a file that is not in object storage. Re-upload via
  `scripts/ml/upload-artifact.mjs`.
- **Org mismatch.** The admin token does not own the org for the
  model. Confirm via the `ml_models.org_id` column.
- **Concurrent promotion.** Two promotes raced. The second one
  fails with a unique-constraint violation on `(org_id,
  equipment_type, status='deployed')`. Retry once, then
  investigate.

## 5. Post-incident

- File a post-mortem if a rollback was needed.
- If the bad version made it through shadow/canary, expand the
  shadow comparison panels to cover the missed regression class.
- Update the model card with the rollback reason.
