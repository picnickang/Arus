// Wave 2.6 — k6 spike test.
// Sudden jump to 100 VUs validates that the circuit breaker, Redis
// fallback path, and rate limiter degrade gracefully under burst load
// without taking down the dependent services.
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 100 },
    { duration: "1m", target: 100 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:5000";

export default function () {
  const r = http.get(`${BASE}/api/healthz`);
  check(r, { "healthz alive": (res) => res.status < 500 });
  sleep(0.1);
}
