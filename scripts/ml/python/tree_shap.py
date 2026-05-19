"""Push A1 sidecar — Per-instance TreeSHAP attribution.

Uses XGBoost's built-in `Booster.predict(pred_contribs=True)` which
emits exact TreeSHAP values directly from the tree structure — no
`shap` library required, no approximation.

The deployed model artifact is loaded directly from disk via the path
recorded in ml_models.training_metrics.nativeArtifactPath. SHAP
attributions therefore explain the *exact* booster that produced the
prediction — not a re-fit surrogate.

Contract:
  in:  stdin JSON  {"modelId": "...", "orgId": "...", "features": {meanTemp: 50, ...}}
  out: stdout JSON {"stage":"shap","baseValue":..,"shapValues":{feature:value,...}}
       or {"stage":"error","message":"..."}

Designed for child_process.spawn from
server/ml-explainability-python-shap.ts. One process per call (simple,
no IPC framing).
"""
from __future__ import annotations

import json
import os
import sys

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


def load_model_meta(conn, model_id: str, org_id: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT type, equipment_type, training_metrics FROM ml_models WHERE id=%s AND org_id=%s",
            (model_id, org_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    model_type, equip_type, metrics = row
    return {
        "type": model_type,
        "equipmentType": equip_type,
        "metrics": metrics or {},
    }


_BOOSTER_CACHE: dict[str, object] = {}


def load_booster(conn, model_id: str, org_id: str):
    """Load the deployed booster from disk. Returns None when the
    model row is missing, the model is not xgboost, or the native
    artifact path is missing — caller falls back to permutation SHAP."""
    if model_id in _BOOSTER_CACHE:
        return _BOOSTER_CACHE[model_id]
    meta = load_model_meta(conn, model_id, org_id)
    if not meta or meta["type"] != "xgboost":
        return None
    native_path = (meta.get("metrics") or {}).get("nativeArtifactPath")
    if not native_path or not os.path.exists(native_path):
        return None
    import xgboost as xgb

    booster = xgb.Booster()
    booster.load_model(native_path)
    _BOOSTER_CACHE[model_id] = booster
    return booster


def shap_for(booster, features_dict: dict) -> tuple[float, dict[str, float]]:
    import xgboost as xgb

    x = np.asarray(
        [[float(features_dict.get(f, 0.0)) for f in FEATURE_ORDER]],
        dtype=np.float32,
    )
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
        booster = load_booster(conn, model_id, org_id)
        if booster is None:
            return {"stage": "error", "message": "deployed model artifact unavailable"}
        try:
            base_value, shap_values = shap_for(booster, features)
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
