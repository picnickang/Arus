# Load Test Results

## Status

Load tests are wired but not proven in this stabilization pass.

## Commands

```bash
npm run test:load:smoke
npm run test:load:steady
npm run test:load:spike
```

The repository currently exposes load scripts through `scripts/run-load-test.mjs`.

## Current Result

`npm run test:load:smoke` was attempted in this pass and failed before execution because the local runner dependency is missing:

```text
[load-test] `k6` is not installed or not on PATH.
[load-test] Install it with `brew install k6`, or run with `K6_RUNNER=docker` if Docker is available.
```

No p95 latency, error-rate, or WebSocket-scale result should be claimed.

## Required Before Full Production

- Confirm local or CI availability of k6/Docker runner.
- Run smoke, steady, spike, and WebSocket load profiles.
- Record p95 latency, error rate, saturation behavior, and pass/fail.
