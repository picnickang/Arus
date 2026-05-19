"""Push A1 sidecar — Real XGBoost trainer with ONNX export.

Contract (stable across trainer swaps so the Node retraining processor
doesn't need to change):

  in:  --org=<id> --type=<equipmentType>  (env: DATABASE_URL)
  out: JSON lines on stdout. Final line is either
         {"stage":"metrics","modelId":...,"mae":..,"productionMae":..,
          "psi":..,"artifactPath":"models/<type>-<modelId>.onnx", ...}
       or {"stage":"skipped","reason":...}
       or {"stage":"error","message":...}

This replaces the JS calibration baseline at
scripts/ml/train-model-skeleton.mjs for tree-class models. The JS
baseline is kept as a fallback for deployments without Python.

Implementation:
  1. Pull labelled outcomes joined to equipment_features (snapshot at
     prediction time) for (org, equipmentType) over the last
     RETRAIN_WINDOW_DAYS.
  2. 80/20 chronological split (most-recent rows = eval).
  3. Train xgboost.XGBClassifier (binary:logistic) on the train slice.
  4. Compute MAE on the eval slice for the candidate. Production MAE
     is the calibration baseline that the JS trainer would have fit on
     the same data — apples-to-apples promotion gate.
  5. PSI(candidate_probs, production_probs) on the eval slice.
  6. Convert the trained model to ONNX via onnxmltools and save to
     models/<type>-<modelId>.onnx. Feature order matches
     ONNX_FEATURE_ORDER in server/ml-prediction/onnx-adapter.ts.
  7. Register an ml_models row of type="xgboost", status="trained" so
     the existing /ml/models/:id/promote contract can pick it up.
  8. Emit final metrics JSON.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta

import numpy as np

from _db import connect, emit

FEATURE_ORDER = [
    "meanTemp",
    "meanVibration",
    "rmsVibration",
    "meanPressure",
    "kurtosis",
    "peakToPeak",
]

# Mapping from FEATURE_ORDER (camelCase, matches onnx-adapter.ts) to
# equipment_features column names (snake_case).
FEATURE_COLS = {
    "meanTemp": "mean_temp",
    "meanVibration": "mean_vibration",
    "rmsVibration": "rms_vibration",
    "meanPressure": "mean_pressure",
    "kurtosis": "kurtosis",
    "peakToPeak": "peak_to_peak",
}

RETRAIN_WINDOW_DAYS = int(os.environ.get("RETRAIN_WINDOW_DAYS", "7"))
MIN_LABELS = int(os.environ.get("PYTRAINER_MIN_LABELS", "50"))


def fetch_labelled(conn, org_id: str, equipment_type: str):
    """Returns (X, y, prod_probs) — X is a (n, |FEATURE_ORDER|) float
    matrix joined from equipment_features via featureSnapshotId.
    prod_probs is the predicted_failure_probability the production
    model emitted at prediction time (used as the baseline)."""
    since = datetime.now(timezone.utc) - timedelta(days=RETRAIN_WINDOW_DAYS)
    feat_cols_sql = ", ".join(f"ef.{FEATURE_COLS[f]}" for f in FEATURE_ORDER)
    sql = f"""
        SELECT po.predicted_failure_probability,
               po.actual_outcome_label,
               {feat_cols_sql}
          FROM prediction_outcomes po
          JOIN equipment e ON e.id = po.equipment_id
          LEFT JOIN equipment_features ef
                 ON ef.id = po.feature_snapshot_id
                AND ef.org_id = po.org_id
         WHERE po.org_id = %s
           AND e.type = %s
           AND po.use_for_retraining = true
           AND po.actual_outcome_label IS NOT NULL
           AND po.observed_at >= %s
           AND po.feature_snapshot_id IS NOT NULL
      ORDER BY po.observed_at ASC
    """
    with conn.cursor() as cur:
        cur.execute(sql, (org_id, equipment_type, since))
        rows = cur.fetchall()
    if not rows:
        return None, None, None

    prod_probs = []
    labels = []
    feats = []
    for row in rows:
        prob = float(row[0] or 0.0)
        label_str = row[1]
        feat_vals = row[2:]
        if any(v is None for v in feat_vals):
            continue
        prod_probs.append(prob)
        labels.append(1.0 if label_str in ("confirmed", "true_positive") else 0.0)
        feats.append([float(v) for v in feat_vals])
    if not feats:
        return None, None, None
    return (
        np.asarray(feats, dtype=np.float32),
        np.asarray(labels, dtype=np.float32),
        np.asarray(prod_probs, dtype=np.float32),
    )


def psi(a: np.ndarray, b: np.ndarray, buckets: int = 10) -> float:
    if len(a) == 0 or len(b) == 0:
        return 0.0
    ah = np.zeros(buckets)
    bh = np.zeros(buckets)
    for x in a:
        i = min(buckets - 1, max(0, int(x * buckets)))
        ah[i] += 1
    for x in b:
        i = min(buckets - 1, max(0, int(x * buckets)))
        bh[i] += 1
    pa = (ah + 0.5) / (len(a) + buckets * 0.5)
    pb = (bh + 0.5) / (len(b) + buckets * 0.5)
    return float(np.abs(np.sum((pa - pb) * np.log(pa / pb))))


def to_onnx(model, n_features: int) -> bytes:
    """Convert an XGBoost model to ONNX via onnxmltools.

    onnxmltools handles XGBoost's tree dump → ONNX TreeEnsemble nodes
    natively. ONNX opset 13 is broadly compatible with onnxruntime-node.
    """
    from onnxmltools.convert import convert_xgboost
    from onnxmltools.convert.common.data_types import FloatTensorType

    initial_types = [("input", FloatTensorType([None, n_features]))]
    onnx_model = convert_xgboost(model, initial_types=initial_types, target_opset=13)
    return onnx_model.SerializeToString()


def fit_calibration(prod_probs: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Match the JS calibration-baseline grid search so the production
    line is the same model the JS trainer would have built."""
    if len(prod_probs) < 5:
        return 1.0, 0.0
    best_mae = float("inf")
    best = (1.0, 0.0)
    for scale in np.arange(0.5, 1.51, 0.1):
        for bias in np.arange(-0.2, 0.21, 0.05):
            cal = np.clip(prod_probs * scale + bias, 0, 1)
            mae_val = float(np.mean(np.abs(cal - y)))
            if mae_val < best_mae:
                best_mae = mae_val
                best = (float(scale), float(bias))
    return best


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", required=True)
    parser.add_argument("--type", required=True)
    parser.add_argument("--models-dir", default="models")
    args = parser.parse_args()

    started = time.time()

    with connect() as conn:
        X, y, prod_probs = fetch_labelled(conn, args.org, args.type)
        if X is None or len(X) < MIN_LABELS:
            emit({
                "stage": "skipped",
                "reason": f"insufficient labels ({0 if X is None else len(X)} < {MIN_LABELS})",
                "labelsFound": 0 if X is None else int(len(X)),
            })
            return 3

        split = int(len(X) * 0.8)
        if split < 5 or split >= len(X):
            emit({"stage": "skipped", "reason": "split too small after 80/20"})
            return 3

        X_train, X_eval = X[:split], X[split:]
        y_train, y_eval = y[:split], y[split:]
        prod_eval = prod_probs[split:]

        try:
            import xgboost as xgb
        except Exception as exc:  # pragma: no cover
            emit({"stage": "error", "message": f"xgboost import failed: {exc}"})
            return 1

        # Modest model — fast to train, ONNX-exports cleanly, avoids
        # overfitting on small labelled volumes early in the program.
        model = xgb.XGBClassifier(
            n_estimators=80,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            tree_method="hist",
            n_jobs=2,
        )
        model.fit(X_train, y_train, verbose=False)

        cand_probs = model.predict_proba(X_eval)[:, 1].astype(np.float32)
        candidate_mae = float(np.mean(np.abs(cand_probs - y_eval)))

        # Production baseline = best JS-equivalent calibration of the
        # current production probabilities. Promotion gate compares
        # against this so the bar is "beat the existing baseline".
        scale, bias = fit_calibration(prod_probs[:split], y[:split])
        prod_cal = np.clip(prod_eval * scale + bias, 0, 1)
        production_mae = float(np.mean(np.abs(prod_cal - y_eval)))

        drift_psi = psi(cand_probs, prod_cal)

        # Export ONNX artifact.
        os.makedirs(args.models_dir, exist_ok=True)
        model_id = str(uuid.uuid4())
        artifact_rel = os.path.join(args.models_dir, f"{args.type}-{model_id}.onnx")
        try:
            onnx_bytes = to_onnx(model, X.shape[1])
            with open(artifact_rel, "wb") as f:
                f.write(onnx_bytes)
        except Exception as exc:
            emit({"stage": "error", "message": f"ONNX export failed: {exc}"})
            return 1

        # Register the candidate ml_models row. Mirrors the JS trainer's
        # contract so the existing promote/rollback endpoints work.
        duration_ms = int((time.time() - started) * 1000)
        hyperparameters = {
            "n_estimators": 80,
            "max_depth": 4,
            "learning_rate": 0.1,
            "framework": "xgboost",
            "exported": "onnx",
            "featureOrder": FEATURE_ORDER,
        }
        training_metrics = {
            "candidateMae": candidate_mae,
            "productionMae": production_mae,
            "psi": drift_psi,
            "trainSize": int(len(X_train)),
            "evalSize": int(len(X_eval)),
            "artifactPath": artifact_rel,
        }

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ml_models
                  (id, org_id, name, type, status, equipment_type,
                   data_points, data_window_days, training_duration_ms,
                   hyperparameters, training_metrics, trained_on, version)
                VALUES (%s, %s, %s, 'xgboost', 'trained', %s,
                        %s, %s, %s, %s::jsonb, %s::jsonb, NOW(), '1.0')
                """,
                (
                    model_id,
                    args.org,
                    f"{args.type}-xgboost-{datetime.utcnow().date().isoformat()}",
                    args.type,
                    int(len(X)),
                    RETRAIN_WINDOW_DAYS,
                    duration_ms,
                    __import__("json").dumps(hyperparameters),
                    __import__("json").dumps(training_metrics),
                ),
            )
        conn.commit()

        emit({
            "stage": "metrics",
            "org": args.org,
            "type": args.type,
            "mae": candidate_mae,
            "productionMae": production_mae,
            "psi": drift_psi,
            "modelId": model_id,
            "artifactPath": artifact_rel,
            "trainSize": int(len(X_train)),
            "evalSize": int(len(X_eval)),
            "framework": "xgboost",
        })
        emit({"stage": "complete", "modelId": model_id})
        return 0


if __name__ == "__main__":
    sys.exit(main())
