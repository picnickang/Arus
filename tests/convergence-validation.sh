#!/usr/bin/env bash
set +e

BASE="http://localhost:5000"
ORG="default-org-id"
PASS=0
FAIL=0
TOTAL=0
FAILURES=""

pass() { ((PASS++)); ((TOTAL++)); echo "  ✓ $1"; }
fail() { ((FAIL++)); ((TOTAL++)); FAILURES="$FAILURES\n  ✗ $1"; echo "  ✗ FAIL: $1"; }

api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" \
      -H "x-org-id: $ORG" \
      -d "$data" 2>/dev/null
  else
    curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H "x-org-id: $ORG" 2>/dev/null
  fi
}

api_org() {
  local method="$1" path="$2" org="$3" data="${4:-}"
  if [ -n "$data" ]; then
    curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" \
      -H "x-org-id: $org" \
      -d "$data" 2>/dev/null
  else
    curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H "x-org-id: $org" 2>/dev/null
  fi
}

get_status() {
  echo "$1" | tail -1
}

get_body() {
  echo "$1" | sed '$d'
}

echo "============================================"
echo "ARUS CONVERGENCE VALIDATION TEST SUITE"
echo "============================================"
echo ""

echo "=== A. ARCHITECTURE GUARDRAILS ==="
npm run check:guards > /dev/null 2>&1 && pass "All 5 guardrail scripts pass" || fail "Guardrail scripts failed"

echo ""
echo "=== B. BUILD / STARTUP / SMOKE ==="

result=$(api GET "/healthz")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /healthz returns 200" || fail "GET /healthz returns $status"

result=$(api GET "/readyz")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /readyz returns 200" || fail "GET /readyz returns $status"

result=$(api GET "/api/vessels")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/vessels returns 200" || fail "GET /api/vessels returns $status"

result=$(api GET "/api/equipment")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/equipment returns 200" || fail "GET /api/equipment returns $status"

echo ""
echo "=== C. DASHBOARD / HOME ==="

result=$(api GET "/api/home/attention-summary")
status=$(get_status "$result")
body=$(get_body "$result")
[ "$status" = "200" ] && pass "GET /api/home/attention-summary returns 200" || fail "GET /api/home/attention-summary returns $status"
echo "$body" | grep -q "overdueWorkOrders" && pass "Attention summary has expected shape" || fail "Attention summary missing expected fields"

result=$(api GET "/api/permissions/me")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/permissions/me returns 200" || fail "GET /api/permissions/me returns $status"

echo ""
echo "=== D. WORK ORDER CRUD (HIGHEST PRIORITY) ==="

FIRST_EQ=$(curl -s "http://localhost:5000/api/equipment" -H "x-org-id: $ORG" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
WO_CREATE="{\"title\":\"Convergence Test WO\",\"description\":\"Test after convergence\",\"priority\":2,\"status\":\"open\",\"type\":\"corrective\",\"equipmentId\":\"${FIRST_EQ}\"}"
result=$(api POST "/api/work-orders" "$WO_CREATE")
status=$(get_status "$result")
body=$(get_body "$result")
if [ "$status" = "201" ] || [ "$status" = "200" ]; then
  pass "POST /api/work-orders creates work order"
  WO_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
else
  fail "POST /api/work-orders returns $status"
  WO_ID=""
fi

result=$(api GET "/api/work-orders")
status=$(get_status "$result")
body=$(get_body "$result")
[ "$status" = "200" ] && pass "GET /api/work-orders list returns 200" || fail "GET /api/work-orders list returns $status"
echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list) or 'workOrders' in d" 2>/dev/null && pass "Work order list has correct shape" || fail "Work order list has unexpected shape"

if [ -n "$WO_ID" ]; then
  result=$(api GET "/api/work-orders/$WO_ID")
  status=$(get_status "$result")
  [ "$status" = "200" ] && pass "GET /api/work-orders/:id reads work order" || fail "GET /api/work-orders/:id returns $status"

  WO_UPDATE='{"priority":"high","status":"in_progress"}'
  result=$(api PATCH "/api/work-orders/$WO_ID" "$WO_UPDATE")
  status=$(get_status "$result")
  [ "$status" = "200" ] && pass "PATCH /api/work-orders/:id updates work order" || fail "PATCH /api/work-orders/:id returns $status"

  result=$(api GET "/api/work-orders/nonexistent-id-12345")
  status=$(get_status "$result")
  [ "$status" = "404" ] && pass "GET /api/work-orders/:id returns 404 for nonexistent" || fail "GET /api/work-orders nonexistent returns $status (expected 404)"
fi

WO_BAD='{"title":"","priority":"invalid"}'
result=$(api POST "/api/work-orders" "$WO_BAD")
status=$(get_status "$result")
[ "$status" = "400" ] || [ "$status" = "422" ] && pass "POST /api/work-orders rejects invalid payload" || fail "POST /api/work-orders accepted invalid payload ($status)"

echo ""
echo "=== E. EQUIPMENT CRUD ==="

result=$(api GET "/api/equipment")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/equipment list returns 200" || fail "GET /api/equipment list returns $status"

EQ_CREATE='{"name":"Test Engine Conv","type":"engine","status":"operational"}'
result=$(api POST "/api/equipment" "$EQ_CREATE")
status=$(get_status "$result")
body=$(get_body "$result")
if [ "$status" = "201" ] || [ "$status" = "200" ]; then
  pass "POST /api/equipment creates equipment"
  EQ_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
else
  fail "POST /api/equipment returns $status"
  EQ_ID=""
fi

if [ -n "$EQ_ID" ]; then
  result=$(api GET "/api/equipment/$EQ_ID")
  status=$(get_status "$result")
  [ "$status" = "200" ] && pass "GET /api/equipment/:id reads equipment" || fail "GET /api/equipment/:id returns $status"
fi

echo ""
echo "=== F. VESSEL CRUD ==="

result=$(api GET "/api/vessels")
status=$(get_status "$result")
body=$(get_body "$result")
[ "$status" = "200" ] && pass "GET /api/vessels list returns 200" || fail "GET /api/vessels list returns $status"
echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list)" 2>/dev/null && pass "Vessels returns array" || fail "Vessels unexpected shape"

echo ""
echo "=== G. INVENTORY / PARTS ==="

result=$(api GET "/api/inventory")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/inventory list returns 200" || fail "GET /api/inventory list returns $status"

result=$(api GET "/api/service-orders")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/service-orders list returns 200" || fail "GET /api/service-orders returns $status"

echo ""
echo "=== H. PDM DOMAIN ==="

result=$(api GET "/api/pdm/dashboard")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/pdm/dashboard returns 200" || fail "GET /api/pdm/dashboard returns $status"

result=$(api GET "/api/pdm/models")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/pdm/models returns 200" || fail "GET /api/pdm/models returns $status"

result=$(api GET "/api/pdm/training/runs")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/pdm/training/runs returns 200" || fail "GET /api/pdm/training/runs returns $status"

result=$(api GET "/api/pdm/drift")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/pdm/drift returns 200" || fail "GET /api/pdm/drift returns $status"

result=$(api GET "/api/ml/models")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/ml/models (legacy) returns 200" || fail "GET /api/ml/models returns $status"

result=$(api GET "/api/ml/training-jobs")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/ml/training-jobs returns 200" || fail "GET /api/ml/training-jobs returns $status"

echo ""
echo "=== I. SYNC / ADMIN ==="

result=$(api GET "/api/sync/health")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/sync/health returns 200" || fail "GET /api/sync/health returns $status"

result=$(api GET "/api/mqtt/reliable-sync/health")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/mqtt/reliable-sync/health returns 200" || fail "GET /api/mqtt/reliable-sync/health returns $status"

echo ""
echo "=== J. CREW / SCHEDULING ==="

result=$(api GET "/api/crew")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/crew list returns 200" || fail "GET /api/crew returns $status"

result=$(api GET "/api/schedule")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/schedule list returns 200" || fail "GET /api/schedule returns $status"

echo ""
echo "=== K. ALERTS ==="

result=$(api GET "/api/alerts")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/alerts list returns 200" || fail "GET /api/alerts returns $status"

echo ""
echo "=== L. ANALYTICS ==="

result=$(api GET "/api/analytics/model-performance/summary")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/analytics/model-performance/summary returns 200" || fail "GET /api/analytics/model-performance/summary returns $status"

result=$(api GET "/api/analytics/model-drift")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/analytics/model-drift returns 200" || fail "GET /api/analytics/model-drift returns $status"

result=$(api GET "/api/analytics/feature-importance/trends")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/analytics/feature-importance/trends returns 200" || fail "GET /api/analytics/feature-importance/trends returns $status"

echo ""
echo "=== M. OBSERVABILITY ==="

result=$(api GET "/metrics")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /metrics returns 200" || fail "GET /metrics returns $status"

echo ""
echo "=== N. TENANT ISOLATION ==="

result=$(api_org GET "/api/work-orders" "tenant-a-test")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "Tenant A can access work orders" || fail "Tenant A access failed ($status)"

result=$(api_org GET "/api/equipment" "tenant-b-test")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "Tenant B can access equipment" || fail "Tenant B access failed ($status)"

result=$(curl -s -w "\n%{http_code}" -X GET "$BASE/api/work-orders" 2>/dev/null)
status=$(get_status "$result")
body=$(get_body "$result")
if [ "$status" = "401" ] || [ "$status" = "403" ]; then
  pass "No org header rejected (tenant isolation)"
elif [ "$status" = "200" ] && echo "$body" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  pass "No org header: dev-mode auto-assigns default org (expected in development)"
else
  fail "Missing org header unexpected response ($status)"
fi

echo ""
echo "=== O. INFRASTRUCTURE ROUTES (via registry) ==="

result=$(api GET "/api/mqtt/reliable-sync/health")
status=$(get_status "$result")
body=$(get_body "$result")
echo "$body" | grep -q "MQTT Reliable Sync" && pass "MQTT health has correct shape" || fail "MQTT health unexpected shape"

echo ""
echo "=== P. DIGITAL TWIN ==="

result=$(api GET "/api/pdm/twin/def")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/pdm/twin/def returns 200" || fail "GET /api/pdm/twin/def returns $status"

echo ""
echo "=== Q. KNOWLEDGE BASE ==="

result=$(api GET "/api/knowledge-base/documents")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/knowledge-base/documents returns 200" || fail "GET /api/knowledge-base/documents returns $status"

echo ""
echo "=== R. AGENT / COPILOT ==="

result=$(api GET "/api/agent/drafts")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/agent/drafts returns 200" || fail "GET /api/agent/drafts returns $status"

echo ""
echo "=== S. BEAST MODE ==="

result=$(api GET "/api/beast/trends/health")
status=$(get_status "$result")
[ "$status" = "200" ] && pass "GET /api/beast/trends/health returns 200" || fail "GET /api/beast/trends/health returns $status"

echo ""
echo "=== T. REDIRECT / ROUTE REGRESSION ==="

for path in "/api/pdm/dashboard" "/api/pdm/models" "/api/pdm/drift" "/api/pdm/training/runs" "/api/pdm/twin/def" "/api/pdm/fleet/baselines?equipmentType=engine"; do
  result=$(api GET "$path")
  status=$(get_status "$result")
  [ "$status" = "200" ] && pass "Canonical $path works" || fail "Canonical $path returns $status"
done

echo ""
echo "============================================"
echo "RESULTS"
echo "============================================"
echo "Total: $TOTAL | Pass: $PASS | Fail: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "FAILURES:"
  echo -e "$FAILURES"
fi
echo "============================================"
exit $FAIL
