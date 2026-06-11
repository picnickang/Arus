# Aquametro FMCC Integration

## Overview

ARUS integrates with Aquametro FMCC (Fuel Mass Consumption Computer) systems for real-time fuel consumption data. This integration provides accurate, measured fuel consumption values that replace or complement SFOC-based calculations from engine telemetry.

## Capabilities

When FMCC is enabled, the system provides:

- **Real-time fuel flow measurement** - Direct FO/DO flow rate readings
- **Fuel density compensation** - Temperature-compensated mass flow calculations
- **Cumulative fuel counters** - Aggregated consumption over periods
- **Multi-circuit monitoring** - Separate tracking for main engine, generators, and auxiliary systems

## Configuration

### Environment Variables

| Variable                   | Description                                   | Required         | Default |
| -------------------------- | --------------------------------------------- | ---------------- | ------- |
| `FMCC_ENABLED`             | Enable FMCC integration                       | No               | `false` |
| `FMCC_API_URL`             | Aquametro REST API endpoint                   | If enabled       | -       |
| `FMCC_API_KEY`             | API authentication key                        | If REST API used | -       |
| `FMCC_MODBUS_HOST`         | Modbus TCP host address                       | If Modbus used   | -       |
| `FMCC_MODBUS_PORT`         | Modbus TCP port                               | No               | `502`   |
| `FMCC_MODBUS_UNIT_ID`      | Modbus unit/slave ID                          | No               | `1`     |
| `FMCC_POLLING_INTERVAL_MS` | Data polling interval                         | No               | `10000` |
| `FMCC_VESSEL_MAPPING`      | JSON mapping of vessel IDs to FMCC device IDs | No               | `{}`    |

### Example Configuration

```bash
# Enable FMCC integration
FMCC_ENABLED=true

# REST API configuration (preferred)
FMCC_API_URL=https://fmcc-gateway.vessel.local/api/v1
FMCC_API_KEY=your-api-key-here

# Or Modbus TCP configuration (for direct connection)
FMCC_MODBUS_HOST=192.168.1.100
FMCC_MODBUS_PORT=502
FMCC_MODBUS_UNIT_ID=1

# Vessel to FMCC device mapping
FMCC_VESSEL_MAPPING={"vessel-uuid-1":"fmcc-001","vessel-uuid-2":"fmcc-002"}
```

## Data Flow

### Fuel & Emissions Log Auto-Fill

When auto-filling Fuel & Emissions Log entries:

1. System checks if FMCC is enabled and connected
2. If available, fetches measured fuel consumption from FMCC
3. FMCC data takes priority over SFOC-calculated estimates
4. Data source is recorded as `fmcc` in the log entry
5. Data quality is marked as `high` for measured values

### Engine Room Logbook Integration

The Engine Room Logbook daily fuel consumption fields are also populated from FMCC when available:

- `fuelMeConsumption` - Main engine FO consumption
- `fuelDgConsumption` - Diesel generator DO consumption
- `fuelTotalConsumption` - Total fuel consumption

### Failsafe Behavior

If FMCC is unavailable or returns errors:

- System falls back to SFOC-based calculations from engine telemetry
- Data source is recorded as `estimated`
- Warning is logged but operation continues
- No user intervention required

## API Endpoints

### GET /api/integrations/fmcc/status

Returns current FMCC integration status.

**Response:**

```json
{
  "ok": true,
  "fmcc": {
    "enabled": true,
    "ready": true,
    "restApiConfigured": true,
    "modbusConfigured": false,
    "connectionStatus": "connected"
  },
  "capabilities": [
    "Real-time fuel flow measurement",
    "Fuel density compensation",
    "Cumulative fuel counters",
    "Multi-circuit monitoring"
  ]
}
```

### GET /api/integrations/fmcc/diagnostic?vesselId=xxx

Tests FMCC connectivity for a specific vessel.

**Response:**

```json
{
  "ok": true,
  "status": "connected",
  "source": "rest",
  "data": {
    "foFlowRate": 0.45,
    "doFlowRate": 0.12,
    "foDensity": 0.991,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### GET /api/integrations/fmcc/fuel/:vesselId?startDate=&endDate=

Retrieves cumulative fuel consumption for a date range.

**Response:**

```json
{
  "ok": true,
  "vesselId": "vessel-uuid",
  "period": {
    "start": "2024-01-15T00:00:00Z",
    "end": "2024-01-15T23:59:59Z"
  },
  "source": "rest",
  "data": {
    "foConsumedMt": 12.45,
    "doConsumedMt": 3.21,
    "totalFuelMt": 15.66,
    "avgFoDensity": 0.991,
    "avgDoTemperature": 35.5,
    "dataPoints": 8640,
    "dataCompleteness": 0.98
  }
}
```

## Frontend Indicators

### FMCC Status Badge

The Fuel & Emissions Log page displays an FMCC status badge:

- **Blue "FMCC Active"** - Integration enabled and connected
- **Yellow "FMCC Connecting"** - Enabled but not yet ready
- **Gray "FMCC Disabled"** - Integration not configured

### Data Source Column

Log entries show the data source:

- **Blue "FMCC" badge** with lightning icon - Measured data
- **Gray badge** with calculator icon - Estimated from telemetry

Hover over badges for detailed information about the data source.

## Aquametro FMCC Specifications

### Supported Models

- FMCC-V Series (volumetric)
- FMCC-M Series (mass flow)
- FMCC-NG (next generation with digital output)

### Communication Protocols

1. **REST API** (preferred)
   - JSON format
   - HTTPS with API key authentication
   - Polling-based data retrieval

2. **Modbus TCP**
   - Direct register access
   - Real-time readings
   - Suitable for vessel-side deployment

### Register Map (Modbus)

| Register | Description    | Type    | Unit  |
| -------- | -------------- | ------- | ----- |
| 0-1      | FO Flow Rate   | Float32 | m³/h  |
| 2-3      | DO Flow Rate   | Float32 | m³/h  |
| 4-5      | FO Density     | Float32 | kg/m³ |
| 6-7      | DO Temperature | Float32 | °C    |
| 8-11     | FO Cumulative  | Float64 | m³    |
| 12-15    | DO Cumulative  | Float64 | m³    |

## Troubleshooting

### FMCC Not Connecting

1. Check `FMCC_ENABLED=true` in environment
2. Verify API URL is accessible from server
3. Confirm API key is valid
4. Check vessel mapping includes the target vessel

### Data Quality Issues

1. Verify FMCC device is calibrated
2. Check for sensor fouling or air bubbles
3. Review temperature compensation settings
4. Compare against manual tank soundings

### Missing Historical Data

1. Check FMCC data retention settings
2. Verify time synchronization between systems
3. Review data polling interval settings

## Best Practices

1. **Redundancy**: Keep SFOC calculations as backup
2. **Calibration**: Schedule regular FMCC calibration
3. **Monitoring**: Use diagnostic endpoint for health checks
4. **Mapping**: Maintain accurate vessel-to-device mapping
5. **Logging**: Review logs for connection issues

## References

- [Aquametro FMCC Technical Manual](https://www.aquametro.com/en/products/fuel-oil-coriolis-mass-flow-measuring-systems)
- [IMO Guidelines on Ship Fuel Oil Consumption Data Collection](https://www.imo.org/en/OurWork/Environment/Pages/Data-Collection-System.aspx)
- MARPOL Annex VI Fuel Consumption Reporting Requirements
