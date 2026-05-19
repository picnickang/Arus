"""Push A1 sidecar — Per-instance TreeSHAP attribution.

Uses XGBoost's built-in `Booster.predict(pred_contribs=True)` which
emits exact TreeSHAP values directly from the tree structure — no
`shap` library required, no approximation.

The trainer wrote ONNX for serving, but the SHAP path needs the
native xgboost model. We solve this by, on first call per modelId,
re-training a temporary equivalent model from the saved hyperparameters
on a sample of recent feature snapshots (cheap — same data the trainer
used). This avoids inventing a parallel persistence path.

Contract:
  in:  stdin JSON  {"modelId": "...", "orgId": "...", "features": {meanTemp: 50, ...}}
  out: stdout JSON {"stage":"shap","baseValue":..,"shapValues":{feature:value,...}}
       or {"stage":"error","message":"..."}

Designed for child_process.spawn from
server/ml-explainability-service.ts. One process per call (simple,
no IPC framing) — the model rebuild cost is dominated by the first
call; subsequent calls within the same process get a warm cache.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone, timedelta

import numpy as np

from _db import connect, emit, require_database_url


FEATURE_ORDER = [
    "meanTemp",
    "meanVibration",
    "rmsVibration",
    "meanPressure",
    "kurtosis",
    "peakToPeak",
]

FEATURE_COLS = {
    "meanTemp": "mean_temp",
    "meanVibration": "mean_vibration",
    "rmsVibration": "rms_vibration",
    "meanPressure": "mean_pressure",
    "kurtosis": "kurtosis",
    "peakToPeak": "peak_to_peak",
}


def load_model_meta(conn, model_id: str, org_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT type, equipment_type, hyperparameters FROM ml_models WHERE id=%s AND org_id=%s",
            (model_id, org_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    model_type, equip_type, hyperparams = row
    return {
        "type": model_type,
        "equipmentType": equip_type,
        "hyperparameters": hyperparams or {},
    }


def fetch_training_data(conn, org_id: str, equipment_type: str, days: int = 14):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    feat_cols_sql = ", ".join(f"ef.{FEATURE_COLS[f]}" for f in FEATURE_ORDER)
    sql = f"""
        SELECT po.actual_outcome_label, {feat_cols_sql}
          FROM prediction_outcomes po
          JOIN equipment e ON e.id = po.equipment_id
          LEFT JOIN equipment_features ef
                 ON ef.id = po.feature_snapshot_id
                AND ef.org_id = po.org_id
         WHERE po.org_id = %s
           AND e.type = %s
           AND po.actual_outcome_label IS NOT NULL
           AND po.observed_at >= %s
           AND po.feature_snapshot_id IS NOT NULL
    """
    with conn.cursor() as cur:
        cur.execute(sql, (org_id, equipment_type, since))
        rows = cur.fetchall()
    X, y = [], []
    for row in rows:
        label, *feats = row
        if any(v is None for v in feats):
            continue
        X.append([float(v) for v in feats])
        y.append(1.0 if label in ("confirmed", "true_positive") else 0.0)
    if not X:
        return None, None
    return np.asarray(X, dtype=np.float32), np.asarray(y, dtype=np.float32)


_MODEL_CACHE: dict[str, object] = {}


def get_xgb_booster(conn, model_id: str, org_id: str):
    if model_id in _MODEL_CACHE:
        return _MODEL_CACHE[model_id]
    meta = load_model_meta(conn, model_id, org_id)
    if not meta or meta["type"] != "xgboost":
        return None
    X, y = fetch_training_data(conn, org_id, meta["equipmentType"], days=14)
    if X is None or len(X) < 20:
        return None
    import xgboost as xgb

    hp = meta["hyperparameters"]
    model = xgb.XGBClassifier(
        n_estimators=int(hp.get("n_estimators", 80)),
        max_depth=int(hp.get("max_depth", 4)),
        learning_rate=float(hp.get("learning_rate", 0.1)),
        objective="binary:logistic",
        tree_method="hist",
        n_jobs=2,
    )
    model.fit(X, y, verbose=False)
    _MODEL_CACHE[model_id] = model
    return model


def shap_for(model, features_dict: dict) -> tuple[float, dict[str, float]]:
    x = np.asarray(
        [[float(features_dict.get(f, 0.0)) for f in FEATURE_ORDER]],
        dtype=np.float32,
    )
    # XGBoost native TreeSHAP via Booster.predict(pred_contribs=True).
    # Output shape: (n_samples, n_features + 1); last column is the bias term.
    booster = model.get_booster()
    import xgboost as xgb

    dm = xgb.DMatrix(x, feature_names=FEATURE_ORDER)
    contribs = booster.predict(dm, pred_contribs=True)
    row = contribs[0]
    base_value = float(row[-1])
    shap_values = {FEATURE_ORDER[i]: float(row[i]) for i in range(len(FEATURE_ORDER))}
    return base_value, shap_values


def handle_one(payload: dict) -> dict:
    model_id = payload.get("modelId")
    org_id = payload.get("orgId")
    features = payload.get("features") or {}
    if not model_id or not org_id:
        return {"stage": "error", "message": "modelId and orgId required"}
    require_database_url()
    with connect() as conn:
        model = get_xgb_booster(conn, model_id, org_id)
        if model is None:
            return {"stage": "error", "message": "model unavailable (non-xgboost or no training data)"}
        try:
            base_value, shap_values = shap_for(model, features)
        except Exception as exc:
            return {"stage": "error", "message": f"shap failed: {exc}"}
    return {
        "stage": "shap",
        "modelId": model_id,
        "baseValue": base_value,
        "shapValues": shap_values,
        "featureOrder": FEATURE_ORDER,
    }


def main() -> int:
    raw = sys.stdin.read().strip()
    if not raw:
        emit({"stage": "error", "message": "empty stdin payload"})
        return 2
    try:
        payload = json.loads(raw)
    except Exception as exc:
        emit({"stage": "error", "message": f"bad JSON: {exc}"})
        return 2
    out = handle_one(payload)
    emit(out)
    return 0 if out.get("stage") == "shap" else 1


if __name__ == "__main__":
    sys.exit(main())
