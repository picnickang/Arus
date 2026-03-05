#!/bin/bash
set -e

OUTPUT="code-export/export-ai-ml-pdm.txt"
SEPARATOR="=================================================================="

> "$OUTPUT"
count=0

append_file() {
  if [ -f "$1" ]; then
    echo "$SEPARATOR" >> "$OUTPUT"
    echo "FILE: $1" >> "$OUTPUT"
    echo "$SEPARATOR" >> "$OUTPUT"
    cat "$1" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    count=$((count + 1))
  fi
}

append_dir() {
  local dir="$1"
  local pattern="${2:-*.ts}"
  if [ -d "$dir" ]; then
    find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) | sort | while read -r f; do
      append_file "$f"
    done
  fi
}

echo "Generating AI/ML/PdM code export..."

echo ">> Shared schemas and types..."
for f in \
  shared/schema/ml-analytics.ts \
  shared/schema/ml-analytics-core.ts \
  shared/schema/ml-analytics-advanced.ts \
  shared/analytics-types.ts \
  shared/sqlite-schema/ml-analytics.ts \
  shared/sensorKindPresets.ts; do
  append_file "$f"
done
append_dir "shared/analytics-types"

echo ">> Server PdM..."
append_dir "server/pdm"

echo ">> Server domains (condition-monitoring, health-monitoring, iot-processing, insights)..."
append_dir "server/domains/condition-monitoring"
append_dir "server/domains/health-monitoring"
append_dir "server/domains/iot-processing"
append_dir "server/domains/insights"

echo ">> Server telemetry..."
append_dir "server/telemetry"

echo ">> Server RAG/LLM services..."
append_dir "server/services/rag"

echo ">> Client features (pdm, ml-ai, analytics, telemetry, maintenance)..."
append_dir "client/src/features/pdm"
append_dir "client/src/features/ml-ai"
append_dir "client/src/features/analytics"
append_dir "client/src/features/telemetry"
append_dir "client/src/features/maintenance"

echo ">> Client pages..."
for f in \
  client/src/pages/pdm-dashboard.tsx \
  client/src/pages/pdm-schedule.tsx \
  client/src/pages/pdm-pack.tsx \
  client/src/pages/pdm-equipment-detail.tsx \
  client/src/pages/ml-training.tsx \
  client/src/pages/AIStudioPage.tsx \
  client/src/pages/condition-monitoring-log.tsx \
  client/src/pages/governance-dashboard.tsx; do
  append_file "$f"
done

echo ">> Client components (ai-health, ml-ai, analytics, sensors)..."
append_dir "client/src/components/ai-health"
append_dir "client/src/components/ml-ai"
append_dir "client/src/components/analytics"
append_dir "client/src/components/sensors"

echo ">> Client utilities..."
append_file "client/src/lib/ml-terminology.ts"
append_file "client/src/lib/analytics-priority.ts"
append_file "client/src/hooks/useSensorData.ts"
append_file "client/src/lib/api/analytics.ts"
append_file "client/src/lib/api/devices.ts"

echo ""
size=$(wc -c < "$OUTPUT")
size_kb=$((size / 1024))
lines=$(wc -l < "$OUTPUT")
echo "Done! $OUTPUT: $count files, ${size_kb} KB, ${lines} lines"
ls -lh "$OUTPUT"
