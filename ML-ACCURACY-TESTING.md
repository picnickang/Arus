# ML Model Accuracy Testing Guide

This guide explains how to test the ML prediction models using synthetic telemetry data to validate accuracy against known failure scenarios.

## Overview

The ARUS platform includes three tools for comprehensive ML accuracy testing:

1. **`generate-fake-telemetry.ts`** - Generates realistic marine equipment sensor data
2. **`upload-telemetry.ts`** - Uploads telemetry data via the API
3. **`test-ml-accuracy.ts`** - End-to-end accuracy testing with automated metrics

## Quick Start

### Step 0: Setup Test Equipment (Required)

Before uploading telemetry, create the equipment records in the database:

```bash
npx tsx server/scripts/setup-test-equipment.ts
```

This creates 8 test equipment records for the accuracy testing scenarios. The telemetry ingestion endpoint validates equipment ownership for security, so equipment must exist before uploading readings.

### Step 1: Generate Test Data

Generate telemetry data for equipment with a known failure scenario:

```bash
# Generate 30 days of data with failure on day 25
npx tsx server/scripts/generate-fake-telemetry.ts \
  --equipment test-engine-001 \
  --days 30 \
  --failure-at 25 \
  --output ./test-data.json

# Generate healthy equipment (no failure)
npx tsx server/scripts/generate-fake-telemetry.ts \
  --equipment test-engine-002 \
  --days 30 \
  --output ./healthy-data.json
```

**Options:**

- `--equipment, -e`: Equipment ID (required)
- `--org, -o`: Organization ID (default: "default-org-id")
- `--days, -d`: Number of days to generate (default: 30)
- `--failure-at, -f`: Day when failure occurs (null for healthy)
- `--readings-per-day, -r`: Readings per day (default: 24)
- `--output, -out`: Output file path

### Step 2: Upload to API

Upload the generated telemetry data:

```bash
npx tsx server/scripts/upload-telemetry.ts \
  --file ./test-data.json \
  --url http://localhost:5000
```

**Options:**

- `--file, -f`: Input JSON file path (required)
- `--url, -u`: Base URL of ARUS API (default: http://localhost:5000)
- `--hmac-secret, -s`: HMAC secret for authentication (optional)
- `--batch-size, -b`: Readings per batch (default: 100)
- `--delay, -d`: Delay between requests in ms (default: 100)

### Step 3: Run Automated Accuracy Test

Run the complete end-to-end accuracy test:

```bash
npx tsx server/scripts/test-ml-accuracy.ts
```

This will:

1. Generate telemetry for multiple test scenarios
2. Upload all data to the API
3. Test ML predictions
4. Calculate accuracy metrics (precision, recall, F1 score)
5. Generate a detailed JSON report

## Understanding the Data Generator

### Sensor Types

The generator simulates five marine equipment sensor types:

| Sensor Type     | Unit | Normal Range | Warning | Critical | Degradation Pattern       |
| --------------- | ---- | ------------ | ------- | -------- | ------------------------- |
| **temperature** | °C   | 65-85        | >90     | >95      | Increases over time       |
| **vibration**   | Hz   | 0.5-2.0      | >3.5    | >5.0     | Increases over time       |
| **pressure**    | psi  | 80-120       | <65     | <50      | Decreases over time       |
| **flow_rate**   | gpm  | 100-150      | <75     | <60      | Decreases over time       |
| **oil_quality** | ppm  | 10-50        | >100    | >150     | Increases (contamination) |

### Realistic Patterns

The generator creates authentic marine equipment behavior:

1. **Daily Variation**: Sine wave patterns simulating load cycles
2. **Random Noise**: Realistic sensor noise within ±5%
3. **Gradual Degradation**: Linear degradation throughout lifecycle
4. **Accelerated Failure**: 2x degradation rate in final 14 days before failure
5. **Status Transitions**: Automatic warning→critical status as values exceed thresholds

### Sample Output

```json
{
  "orgId": "default-org-id",
  "equipmentId": "test-engine-001",
  "sensorType": "temperature",
  "value": 76.5,
  "unit": "celsius",
  "threshold": 90,
  "status": "normal",
  "timestamp": "2025-11-02T08:00:00.000Z"
}
```

## Test Scenarios

### Scenario 1: Healthy Equipment

Equipment operating normally with no impending failure:

```bash
npx tsx server/scripts/generate-fake-telemetry.ts \
  --equipment healthy-pump-001 \
  --days 30
```

**Expected ML Prediction:**

- Failure Probability: <30%
- Health Score: >70
- Status: HEALTHY

### Scenario 2: Near-Term Failure

Equipment that will fail soon (within 7 days):

```bash
npx tsx server/scripts/generate-fake-telemetry.ts \
  --equipment failing-engine-001 \
  --days 30 \
  --failure-at 28
```

**Expected ML Prediction:**

- Failure Probability: >70%
- Health Score: <40
- Status: WILL FAIL
- Predicted Days: 5-10

### Scenario 3: Mid-Term Failure

Equipment with moderate degradation (failure in 14-21 days):

```bash
npx tsx server/scripts/generate-fake-telemetry.ts \
  --equipment degrading-compressor-001 \
  --days 30 \
  --failure-at 21
```

**Expected ML Prediction:**

- Failure Probability: 40-60%
- Health Score: 50-60
- Status: MONITOR

## Accuracy Metrics

The test-ml-accuracy script calculates standard classification metrics:

### Confusion Matrix

|                      | Predicted Healthy   | Predicted Failure   |
| -------------------- | ------------------- | ------------------- |
| **Actually Healthy** | True Negative (TN)  | False Positive (FP) |
| **Actually Failing** | False Negative (FN) | True Positive (TP)  |

### Metrics Formulas

- **Accuracy**: (TP + TN) / (TP + TN + FP + FN)
- **Precision**: TP / (TP + FP) - "Of all predicted failures, how many were correct?"
- **Recall**: TP / (TP + FN) - "Of all actual failures, how many did we catch?"
- **F1 Score**: 2 × (Precision × Recall) / (Precision + Recall) - Harmonic mean

### Target Performance

- **Target Accuracy**: ≥90% (90-95% goal)
- **Minimum Precision**: ≥85% (avoid false alarms)
- **Minimum Recall**: ≥90% (catch failures)
- **F1 Score**: ≥85%

## Example Workflow

### Complete Manual Test

```bash
# 1. Generate test datasets
npx tsx server/scripts/generate-fake-telemetry.ts --equipment engine-001 --days 30 --output e1.json
npx tsx server/scripts/generate-fake-telemetry.ts --equipment engine-002 --days 30 --failure-at 25 --output e2.json
npx tsx server/scripts/generate-fake-telemetry.ts --equipment pump-001 --days 30 --failure-at 20 --output p1.json

# 2. Upload all datasets
npx tsx server/scripts/upload-telemetry.ts --file e1.json
npx tsx server/scripts/upload-telemetry.ts --file e2.json
npx tsx server/scripts/upload-telemetry.ts --file p1.json

# 3. Train ML models (via API)
curl -X POST http://localhost:5000/api/ml/train/lstm \
  -H "Content-Type: application/json" \
  -H "x-org-id: default-org-id" \
  -d '{"equipmentType": "general"}'

curl -X POST http://localhost:5000/api/ml/train/random-forest \
  -H "Content-Type: application/json" \
  -H "x-org-id: default-org-id" \
  -d '{"equipmentType": "general"}'

curl -X POST http://localhost:5000/api/ml/train/xgboost \
  -H "Content-Type: application/json" \
  -H "x-org-id: default-org-id" \
  -d '{"equipmentType": "general"}'

# 4. Test predictions
curl -X POST http://localhost:5000/api/ml/predict/failure \
  -H "Content-Type: application/json" \
  -H "x-org-id: default-org-id" \
  -d '{"equipmentId": "engine-001", "method": "ensemble"}'

# 5. View results
cat ml-accuracy-report.json
```

### Automated Test

Run everything automatically:

```bash
npx tsx server/scripts/test-ml-accuracy.ts
```

## Interpreting Results

### Sample Report Output

```json
{
  "timestamp": "2025-11-02T08:30:00.000Z",
  "scenarios": 5,
  "validPredictions": 5,
  "metrics": {
    "accuracy": 0.92,
    "precision": 0.9,
    "recall": 0.95,
    "f1Score": 0.92,
    "truePositives": 3,
    "trueNegatives": 2,
    "falsePositives": 0,
    "falseNegatives": 0
  }
}
```

### Status Indicators

- **🎉 SUCCESS**: Accuracy ≥90% (meets target)
- **⚠️ ACCEPTABLE**: Accuracy 80-89% (below target but functional)
- **❌ NEEDS IMPROVEMENT**: Accuracy <80% (requires action)

## Troubleshooting

### No Predictions Available

If predictions return null or 404:

1. **Check if models are trained**:

   ```bash
   curl http://localhost:5000/api/ml/health
   ```

2. **Train models** using the API endpoints above

3. **Verify telemetry data** was uploaded:
   ```bash
   curl "http://localhost:5000/api/telemetry/latest?equipmentId=test-engine-001"
   ```

### Low Accuracy

If accuracy is below target:

1. **Increase training data**: Generate more days of telemetry
2. **Add more scenarios**: Create diverse failure patterns
3. **Adjust hyperparameters**: Modify model training parameters
4. **Review feature engineering**: Check sensor types and ranges

### Upload Failures

If telemetry upload fails:

1. **Check API is running**: `curl http://localhost:5000/health`
2. **Verify organization ID**: Use correct orgId in headers
3. **Check rate limits**: Add delay between uploads (`--delay 200`)
4. **Review HMAC**: If using edge device endpoints, provide correct secret

## Advanced Usage

### Custom Sensor Profiles

Edit `server/scripts/generate-fake-telemetry.ts` to add custom sensors:

```typescript
const SENSOR_PROFILES: Record<string, SensorProfile> = {
  custom_sensor: {
    type: "custom_sensor",
    unit: "units",
    normalRange: [min, max],
    warningThreshold: threshold1,
    criticalThreshold: threshold2,
    noiseLevel: noise,
    degradationRate: rate, // per day
  },
};
```

### Bulk Test Generation

Generate multiple test scenarios programmatically:

```typescript
import { generateTelemetryDataset } from "./server/scripts/generate-fake-telemetry";

const scenarios = [
  { id: "engine-001", days: 30, failureAt: null },
  { id: "engine-002", days: 30, failureAt: 25 },
  { id: "pump-001", days: 30, failureAt: 20 },
];

for (const scenario of scenarios) {
  const readings = generateTelemetryDataset(
    scenario.id,
    "default-org-id",
    scenario.days,
    scenario.failureAt
  );
  // Process readings...
}
```

## Best Practices

1. **Start Simple**: Test with 2-3 scenarios before scaling up
2. **Known Outcomes**: Always include both healthy and failing equipment
3. **Realistic Timeframes**: Use 30-60 days for meaningful patterns
4. **Diverse Failures**: Test different failure days (near-term, mid-term, far-term)
5. **Document Results**: Save accuracy reports for comparison over time
6. **Iterative Improvement**: Use results to guide model tuning

## Next Steps

After achieving >90% accuracy:

1. **Production Validation**: Test with real equipment telemetry
2. **Continuous Monitoring**: Track accuracy metrics over time
3. **Model Retraining**: Schedule periodic model updates
4. **Threshold Tuning**: Adjust warning/critical thresholds based on results
5. **Feedback Loop**: Implement operator feedback for continuous improvement
