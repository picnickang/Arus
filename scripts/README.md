# ARUS Test Harness

Comprehensive testing suite for ARUS Marine Predictive Maintenance Platform.

## Prerequisites

1. **Environment Variables**

   ```bash
   # Required: Set your admin password
   export ADMIN_TOKEN=your-admin-password
   # OR set in .env file
   ADMIN_TOKEN=your-admin-password
   ```

2. **Database State**
   - **Self-Seeding:** Tests automatically create minimal test data if database is empty
   - **Idempotent:** If data exists, tests use existing vessels and equipment
   - **Safe:** Never interferes with or duplicates production data
   - Tests run against the development database

3. **Dependencies**
   ```bash
   npm install  # Installs undici, fs-extra, and other deps
   ```

## Running Tests

### Quick Smoke Test (~30 seconds)

Validates core functionality without heavy operations:

```bash
node scripts/test_smoke.js
```

**Coverage:**

- ✅ Server health & database connectivity
- ✅ Admin authentication
- ✅ Dashboard API
- ✅ Equipment & vessel APIs
- ✅ Telemetry ingestion
- ✅ Work orders
- ✅ Job queue stats
- ✅ Vessel type presets

### Comprehensive E2E Test (~2-3 minutes)

Full system integration testing:

```bash
node scripts/test_e2e.js
```

**Coverage:**

- ✅ Authentication & authorization
- ✅ Data management (vessels, equipment)
- ✅ Telemetry batch ingestion (50 samples)
- ✅ Vessel simulator (synthetic data generation)
- ✅ ML threshold calibration
- ✅ Predictive analytics (predictions, anomalies)
- ✅ ML models & performance metrics
- ✅ Cost savings & ROI tracking
- ✅ Work order management
- ✅ Background job processing

### Run Both Tests

```bash
node scripts/test_smoke.js && node scripts/test_e2e.js
```

## Test Architecture

### Test Utilities (`test_util.js`)

Shared helper functions for test scripts:

```javascript
import { startServerAndWait, httpJSON, killProcess } from "./test_util.js";

// Start ARUS server and wait for health check
const { child, base } = await startServerAndWait(5001);

// Make authenticated HTTP requests
const result = await httpJSON(`${base}/api/endpoint`, {
  method: "POST",
  body: { data: "value" },
  headers: { authorization: `Bearer ${token}` },
});

// Clean shutdown
killProcess(child);
```

## Test Behavior

### Success Criteria

- All tests throw errors on failure (no silent failures)
- Exit code 0 = success, exit code 1 = failure
- Clear error messages with API responses
- Progress indicators for each phase

### Failure Handling

Tests fail immediately on:

- Missing admin credentials
- Server startup timeout (120s)
- Empty database (no vessels/equipment)
- Any API returning non-2xx status
- Authentication failures

### Ports

- Smoke tests use port **5001**
- E2E tests use port **5002**
- Both ports are different from dev server (5000) to avoid conflicts

## Common Issues

### Error: "ADMIN_TOKEN environment variable is required"

**Solution:** Set your admin password:

```bash
export ADMIN_TOKEN=your-password
# Or add to .env file
```

### Error: "Failed to seed vessel" or "Failed to seed equipment"

**Solution:** The auto-seeding encountered an error. Check:

- Admin authentication is working (ADMIN_TOKEN is correct)
- Database is accessible and migrations are current
- API endpoints `/api/vessels` and `/api/equipment` accept POST requests
- No validation errors in the seed data

### Error: "Server failed to become ready"

**Solution:** Check logs for startup errors:

- Database connection issues
- Missing environment variables
- Port already in use

### Tests timeout or hang

**Solution:**

- Ensure no other ARUS instance is running
- Check database is accessible
- Kill any orphaned node processes: `pkill -f "node.*server/index.ts"`

## Customization

### Change Test Ports

Edit the port number in test scripts:

```javascript
const server = await startServerAndWait(5003); // Custom port
```

### Add New Test Cases

Follow the existing pattern:

```javascript
console.log("Testing new feature...");
const result = await httpJSON(`${base}/api/new-endpoint`);
if (result.status !== 200) {
  throw new Error(`New feature failed: ${result.status}`);
}
console.log("✅ New feature works\n");
```

### Skip Optional Tests

Comment out non-critical test phases in `test_e2e.js` while keeping the error-throwing behavior for critical systems.

## CI/CD Integration

These tests are designed for automated testing:

```yaml
# Example GitHub Actions
- name: Run ARUS Tests
  env:
    ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    node scripts/test_smoke.js
    node scripts/test_e2e.js
```

## Troubleshooting

### Enable Verbose Logging

Modify `test_util.js` to log full server output:

```javascript
child.stdout.on("data", (d) => {
  const msg = d.toString();
  logs += msg;
  console.log("[SERVER]", msg); // Add this line
});
```

### Check Database State

```sql
-- Verify test data exists
SELECT COUNT(*) FROM vessels;
SELECT COUNT(*) FROM equipment;
SELECT COUNT(*) FROM telemetry LIMIT 1;
```

### Manual Server Test

Test server startup independently:

```bash
PORT=5001 NODE_ENV=development node server/index.ts
# Then check: curl http://localhost:5001/health
```

## Development

### Adding Dependencies

Tests use ES modules. Import new dependencies:

```javascript
import newTool from "new-package";
```

### Test Isolation

Each test run:

- Starts a fresh server instance
- Uses separate port from dev server
- Cleans up processes on completion
- Tests against shared development database (not isolated)

## Support

For issues with the test harness:

1. Check this README for common solutions
2. Review test output for specific error messages
3. Verify database seeding and environment variables
4. Check server logs during test execution
