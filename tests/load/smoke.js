// Wave 2.6 — k6 smoke test.
// One virtual user, 30 seconds, public endpoints only. Validates that
// the basic request path is healthy before promoting a build. Run with:
//   BASE_URL=http://localhost:5000 k6 run tests/load/smoke.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:5000";

export default function () {
  const healthz = http.get(`${BASE}/api/healthz`);
  check(healthz, { "healthz 200": (r) => r.status === 200 });

  const readyz = http.get(`${BASE}/api/readyz`);
  check(readyz, { "readyz 200": (r) => r.status === 200 });

  sleep(1);
}
