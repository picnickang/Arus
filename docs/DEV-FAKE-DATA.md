# ARUS Fake Data Seeding (DEV-ONLY)

This document describes how to use the fake data seeding utilities for testing Engine Room Log and Deck Log auto-fill functionality.

## Overview

The fake data seeder generates realistic telemetry, navigation, weather, and event data that feeds into the existing auto-fill services. This allows developers to:

- Test Engine Room Log auto-fill with simulated main engine and generator telemetry
- Test Deck Log auto-fill with simulated weather/StormGeo data
- Demo the system without real hardware or external APIs
- Verify logging workflows (sign-off, editing, compliance)

## Safety Guards

The fake data seeder is **DEV-ONLY** and protected by:

1. `NODE_ENV !== 'production'` - Will not run in production
2. `ENABLE_FAKE_TELEMETRY=1` - Explicit opt-in required
3. `ADMIN_TOKEN` - If configured, admin token authentication required for API endpoint
4. **Concurrency lock** - Prevents duplicate seeding for the same vessel

## Quick Start

### Using the CLI Script

```bash
# Seed both engine and deck logs for the last 24 hours
ENABLE_FAKE_TELEMETRY=1 npx tsx scripts/seed-fake-logs.ts --engine --deck

# Seed engine room log data only for 12 hours
ENABLE_FAKE_TELEMETRY=1 npx tsx scripts/seed-fake-logs.ts --engine --hours=12

# Seed deck log data for a specific vessel
ENABLE_FAKE_TELEMETRY=1 npx tsx scripts/seed-fake-logs.ts --deck --vessel=abc123-uuid

# Show help
npx tsx scripts/seed-fake-logs.ts --help
```

### CLI Options

| Option          | Alias | Description                                             | Default        |
| --------------- | ----- | ------------------------------------------------------- | -------------- |
| `--engine`      | `-e`  | Seed engine room log test data                          | false          |
| `--deck`        | `-d`  | Seed deck log test data                                 | false          |
| `--hours`       | `-h`  | Number of hours back to generate                        | 24             |
| `--vessel`      | `-v`  | Specific vessel ID (uses first vessel if not specified) | -              |
| `--org`         | `-o`  | Organization ID                                         | default-org-id |
| `--interval`    | `-i`  | Data interval in minutes                                | 30             |
| `--vessel-type` | `-t`  | Vessel type profile (tug, psv, tanker, cargo, ferry)    | tug            |

### Using the API Endpoint

```bash
# Check if seeding is available
curl http://localhost:5000/api/dev/seed-status

# Seed both logs (requires ENABLE_FAKE_TELEMETRY=1)
# If ADMIN_TOKEN is configured, add -H "Authorization: Bearer <token>"
curl -X POST http://localhost:5000/api/dev/seed-fake-logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"seedEngine": true, "seedDeck": true, "hours": 24}'

# Seed engine log only
curl -X POST http://localhost:5000/api/dev/seed-fake-logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"seedEngine": true, "seedDeck": false, "hours": 12}'
```

### API Request Body

```json
{
  "vesselId": "optional-uuid",
  "orgId": "optional-org-id",
  "hours": 24,
  "seedEngine": true,
  "seedDeck": true,
  "vesselType": "tug"
}
```

## What Gets Generated

### Engine Room Log Data

For each time interval, the seeder generates:

- **Main Engine telemetry**: RPM, load, fuel rack position, exhaust temps (port/starboard), scavenge air pressure/temp, turbocharger RPM/temp, coolant temps, lub oil pressure/temp, fuel oil pressure/temp/viscosity
- **Auxiliary systems**: Sea water cooling temp, fresh water cooling temp, air compressor pressure, starting air pressure, control air pressure, engine room temp/humidity
- **Generator telemetry** (for each DG): Load kW/%, voltage, frequency, current, power factor, exhaust temp, lub oil pressure, coolant temp, fuel rack position, running hours
- **Events**: ME start/stop, DG start/stop, maintenance, inspections, fuel transfers

### Deck Log Data

For each time interval, the seeder generates:

- **Navigation**: Latitude, longitude, speed over ground (SOG), course over ground (COG)
- **Weather/StormGeo snapshots**: Wind speed/direction/Beaufort, wave height/sea state, swell height/direction, air/sea temperature, barometer, visibility, humidity, cloud cover, sky condition
- **Events**: Departure, arrival, course changes, weather observations, safety drills

## Data Characteristics

### Telemetry Realism

The generated data includes:

- Physics-based relationships (load affects temperature, RPM affects fuel consumption)
- Time-of-day variations (diurnal patterns)
- Realistic noise and small variations
- Coherent navigation routes (Singapore area)
- Weather patterns with consistency

### Vessel Type Profiles

Different vessel types generate different characteristic data:

| Type   | Navigation Pattern           | Typical Speed |
| ------ | ---------------------------- | ------------- |
| tug    | Harbor area, short distances | 8-12 knots    |
| psv    | Offshore transit             | 10-15 knots   |
| tanker | Long transit                 | 8-12 knots    |
| cargo  | Medium transit               | 10-14 knots   |
| ferry  | Regular routes               | 12-18 knots   |

## Verification Steps

After seeding data:

1. **Start the app** as usual (Electron or web dev server)
2. **Navigate to Engine Room Log** for the seeded vessel
   - Verify hourly entries are populated with telemetry data
   - Check that generator entries show load/voltage/frequency
   - Confirm events appear in the event log
3. **Navigate to Deck Log** for the same vessel
   - Verify hourly entries show weather data (wind, waves, etc.)
   - Check that navigation data (position, speed) is populated
   - Confirm events appear in the event log
4. **Test workflows**
   - Sign-off flows should work normally
   - Manual editing should work normally
   - Anomaly detection should flag any out-of-range values

## Cleanup

To reset the development database after testing:

```bash
# Use the Replit database rollback feature, or:
# Clear specific tables (be careful in shared environments)
npm run db:push --force
```

## Architecture

### Components

```
scripts/seed-fake-logs.ts          CLI entrypoint
server/services/dev-fake-data-service.ts   Core seeding service
server/routes.ts                   API endpoint (/api/dev/seed-fake-logs)
```

### Data Flow

```
Fake Data Service
    ├── NavigationGenerator (lat/lon, SOG, COG)
    ├── WeatherGenerator (wind, waves, weather conditions)
    ├── EngineTelemetryGenerator (ME parameters)
    └── GeneratorTelemetryGenerator (DG parameters)
        │
        ├──> equipment_telemetry table
        ├──> stormgeo_snapshots table
        ├──> engine_log_events table
        └──> deck_log_events table
            │
            ├──> Engine Log Auto-Fill Service
            │       └── engine_log_hourly, engine_log_generator
            │
            └──> Deck Log Auto-Fill (StormGeo Service)
                    └── deck_log_hourly
```

## Troubleshooting

### "ENABLE_FAKE_TELEMETRY=1 environment variable required"

Set the environment variable before running:

```bash
ENABLE_FAKE_TELEMETRY=1 npx tsx scripts/seed-fake-logs.ts --engine
```

### "No vessels found"

Create a vessel first using the ARUS UI, or specify a vessel ID that exists in the database.

### "Auto-fill shows no data"

1. Check that telemetry was actually inserted (check `equipment_telemetry` table)
2. Verify the vessel has equipment registered (auto-fill requires equipment to exist)
3. Check logs for any errors during seeding

### "Weather data not appearing in Deck Log"

1. Verify StormGeo snapshots were created (check `stormgeo_snapshots` table)
2. Check that the snapshot timestamps match the log hours being queried
3. Ensure the auto-fill service ran after seeding
