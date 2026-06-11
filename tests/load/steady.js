// Wave 2.6 — k6 steady-state load test.
// Ramps from 20 to 50 VUs over 5 minutes hitting a mix of read paths
// representative of a quiet bridge watch. Use against a seeded staging
// tenant. Requires K6_SESSION_TOKEN if hitting authenticated endpoints.
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:5000";
const TOKEN = __ENV.K6_SESSION_TOKEN || "";

// Send the token both ways: SSO sessions authenticate via the arus_session
// cookie, while dev-login tokens (POST /api/portal/dev-login) are Bearer-only.
const headers = TOKEN ? { Cookie: `arus_session=${TOKEN}`, Authorization: `Bearer ${TOKEN}` } : {};

export default function () {
  const ops = [
    () => http.get(`${BASE}/api/healthz`),
    () => http.get(`${BASE}/api/v1/observability/web-vitals/ping`, { headers }),
  ];
  for (const op of ops) {
    const r = op();
    check(r, { "non-5xx": (res) => res.status < 500 });
  }
  sleep(Math.random() * 2);
}
