# Wave 2.6 — k6 Load Tests

Smoke and steady-state load tests for ARUS. Lives under `tests/load/`
so it stays out of the unit/integration runner and won't auto-execute
in CI unless explicitly invoked.

## Running

Install k6 once (out-of-band, not via npm):

```bash
# macOS
brew install k6

# Linux
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Then point a script at the target environment:

```bash
BASE_URL=http://localhost:5000 k6 run tests/load/smoke.js
BASE_URL=https://staging.example.app k6 run tests/load/steady.js
```

## Scenarios

| File         | Purpose                                          | VUs    | Duration |
| ------------ | ------------------------------------------------ | ------ | -------- |
| `smoke.js`   | One virtual user, public endpoints only          | 1      | 30s      |
| `steady.js`  | Realistic steady-state load (read-mostly)        | 20→50  | 5m       |
| `spike.js`   | Sudden traffic spike — autoscaling / circuit BR  | 100    | 2m       |

## SLOs

The thresholds in each script encode the headline SLOs the system
must meet under that scenario. A failing threshold fails the run.

- `http_req_failed`: <1%
- `http_req_duration p(95)`: <500ms (smoke), <800ms (steady), <1500ms (spike)

## Authenticated paths

Authenticated paths are deliberately omitted from the smoke run —
they require provisioned creds and would couple the load harness to
specific tenant data. Use `steady.js` with `BASE_URL` pointing to a
seeded staging org and `K6_SESSION_TOKEN=...` env var set.
