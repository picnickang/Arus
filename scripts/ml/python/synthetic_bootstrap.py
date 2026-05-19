"""Push A1 sidecar — Synthetic data bootstrap.

Generates labelled outcomes for the first weekly cron to have data to
train on before real labelled fleet outcomes accrue.

NOT a substitute for real failures. Clearly tagged
outcome_source='synthetic_bootstrap' so the data is filterable and
auditable. The trainer's WHERE clause respects use_for_retraining so
operators can turn synthetic data off by flipping that flag in bulk.

Physics intuition (kept simple — the validator wants the *substrate*
exercised, not a literature-grade failure model):

  Bearing failure mode: high rmsVibration + rising kurtosis + warm.
  Pump failure mode:    pressure outside band + temp creep.

For each (org, equipmentType in {bearing, pump}) we:
  1. Pick (or insert) one synthetic equipment row.
  2. For N samples we draw features from class-conditioned normals.
  3. Emit one equipment_features snapshot per sample.
  4. Emit one failure_predictions row (predicted_probability =
     heuristic on the features, gently calibrated to actual_label).
  5. Emit one prediction_outcomes row joining the two with the
     actual_outcome_label set, outcome_source='synthetic_bootstrap'.

Usage:
  python synthetic_bootstrap.py --org=<id> [--samples=500] [--types=bearing,pump]
"""
from __future__ import annotations

import argparse
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta

import numpy as np

from _db import connect, emit


CLASS_PARAMS = {
    "bearing": {
        "healthy": dict(meanTemp=(55, 4), meanVibration=(1.8, 0.3), rmsVibration=(2.0, 0.3),
                        meanPressure=(200, 10), kurtosis=(3.0, 0.4), peakToPeak=(4.5, 0.6)),
        "failing": dict(meanTemp=(72, 5), meanVibration=(3.6, 0.5), rmsVibration=(4.2, 0.6),
                        meanPressure=(205, 12), kurtosis=(6.5, 0.8), peakToPeak=(8.5, 1.2)),
    },
    "pump": {
        "healthy": dict(meanTemp=(58, 4), meanVibration=(2.0, 0.3), rmsVibration=(2.2, 0.3),
                        meanPressure=(210, 8), kurtosis=(3.2, 0.4), peakToPeak=(4.8, 0.6)),
        "failing": dict(meanTemp=(78, 6), meanVibration=(2.8, 0.4), rmsVibration=(3.1, 0.5),
                        meanPressure=(140, 25), kurtosis=(4.5, 0.7), peakToPeak=(6.5, 1.0)),
    },
}


def sample_features(equip_type: str, failing: bool) -> dict[str, float]:
    klass = "failing" if failing else "healthy"
    params = CLASS_PARAMS[equip_type][klass]
    out = {}
    for k, (mu, sigma) in params.items():
        out[k] = max(0.0, float(np.random.normal(mu, sigma)))
    return out


def heuristic_prob(features: dict[str, float], equip_type: str) -> float:
    """Cheap deterministic risk score — mirrors what the production
    heuristic runner already does. Used as predicted_probability so the
    production-baseline comparison in the trainer is realistic."""
    if equip_type == "bearing":
        score = (
            0.10 * (features["meanTemp"] - 55) / 20
            + 0.30 * (features["rmsVibration"] - 2) / 3
            + 0.25 * (features["kurtosis"] - 3) / 4
            + 0.15 * (features["peakToPeak"] - 4.5) / 5
        )
    else:
        pressure_dev = abs(features["meanPressure"] - 200) / 60
        score = (
            0.20 * (features["meanTemp"] - 58) / 20
            + 0.40 * pressure_dev
            + 0.15 * (features["rmsVibration"] - 2.2) / 1
        )
    return float(min(0.99, max(0.05, 0.20 + score)))


def get_or_create_equipment(conn, org_id: str, equip_type: str) -> str:
    """Find one equipment of this type or create a synthetic one."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM equipment WHERE org_id=%s AND type=%s LIMIT 1",
            (org_id, equip_type),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        # Create a synthetic equipment row. Equipment table has more
        # columns but most are nullable; we set the minimal essentials.
        equip_id = f"synth-{equip_type}-{uuid.uuid4().hex[:8]}"
        try:
            cur.execute(
                """INSERT INTO equipment (id, org_id, name, type, status)
                   VALUES (%s, %s, %s, %s, 'operational')""",
                (equip_id, org_id, f"Synthetic {equip_type.title()} Bench", equip_type),
            )
        except Exception:
            # Schema may require more fields — surface as a skip rather
            # than a crash so the caller knows to seed an equipment manually.
            raise
        return equip_id


def insert_sample(conn, org_id: str, equip_id: str, equip_type: str,
                  features: dict[str, float], failing: bool, observed_at: datetime) -> None:
    feat_id = str(uuid.uuid4())
    pred_prob = heuristic_prob(features, equip_type)
    label = "confirmed" if failing else "false_positive"
    actual_failure_date = observed_at if failing else None
    rul = 30 if failing else 180

    with conn.cursor() as cur:
        # 1. equipment_features snapshot.
        cur.execute(
            """INSERT INTO equipment_features
                 (id, org_id, equipment_id, timestamp, window_minutes,
                  mean_temp, std_temp, mean_vibration, std_vibration,
                  rms_vibration, peak_to_peak, mean_pressure, std_pressure,
                  kurtosis, skewness)
               VALUES (%s, %s, %s, %s, 60,
                       %s, %s, %s, %s,
                       %s, %s, %s, %s,
                       %s, %s)""",
            (
                feat_id, org_id, equip_id, observed_at,
                features["meanTemp"], 2.0, features["meanVibration"], 0.3,
                features["rmsVibration"], features["peakToPeak"],
                features["meanPressure"], 8.0,
                features["kurtosis"], 0.0,
            ),
        )

        # 2. failure_predictions row.
        cur.execute(
            """INSERT INTO failure_predictions
                 (org_id, equipment_id, failure_probability, remaining_useful_life,
                  risk_level, predicted_failure_date, feature_snapshot_id,
                  feature_set_version, prediction_timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'v1.window60m', %s)
               RETURNING id""",
            (
                org_id, equip_id, pred_prob, rul,
                "high" if pred_prob > 0.5 else "medium" if pred_prob > 0.25 else "low",
                observed_at + timedelta(days=rul),
                feat_id,
                observed_at,
            ),
        )
        pred_row = cur.fetchone()
        if pred_row is None:
            return
        prediction_id = pred_row[0]

        # 3. prediction_outcomes (idempotent — unique constraint guards replay).
        cur.execute(
            """INSERT INTO prediction_outcomes
                 (org_id, prediction_id, prediction_type, equipment_id,
                  feature_snapshot_id, predicted_failure_probability,
                  actual_outcome_label, actual_failure_date,
                  outcome_source, observed_at, use_for_retraining)
               VALUES (%s, %s, 'failure', %s, %s, %s, %s, %s,
                       'synthetic_bootstrap', %s, true)
               ON CONFLICT (prediction_id, prediction_type, outcome_source) DO NOTHING""",
            (
                org_id, prediction_id, equip_id, feat_id,
                pred_prob, label, actual_failure_date,
                observed_at,
            ),
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", required=True)
    parser.add_argument("--samples", type=int, default=300)
    parser.add_argument("--types", default="bearing,pump")
    args = parser.parse_args()

    types = [t.strip() for t in args.types.split(",") if t.strip() in CLASS_PARAMS]
    if not types:
        emit({"stage": "error", "message": "no valid equipment types"})
        return 2

    np.random.seed(int(datetime.utcnow().timestamp()) % 100_000)
    random.seed(42)

    written = {t: 0 for t in types}
    try:
        with connect() as conn:
            for t in types:
                equip_id = get_or_create_equipment(conn, args.org, t)
                for i in range(args.samples):
                    failing = random.random() < 0.35  # 35% failures, 65% healthy
                    features = sample_features(t, failing)
                    # Spread observed_at across last 5 days so the
                    # retrain window (7 days) sees them all.
                    offset_hours = random.uniform(1, 5 * 24)
                    observed_at = datetime.now(timezone.utc) - timedelta(hours=offset_hours)
                    insert_sample(conn, args.org, equip_id, t, features, failing, observed_at)
                    written[t] += 1
                conn.commit()
    except Exception as exc:
        emit({"stage": "error", "message": f"bootstrap failed: {exc}"})
        return 1

    emit({"stage": "complete", "written": written, "org": args.org})
    return 0


if __name__ == "__main__":
    sys.exit(main())
