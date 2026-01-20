# Marine Sensor Templates Guide

## Overview

ARUS now includes comprehensive marine-specific sensor templates that provide industry-standard thresholds, sample rates, and monitoring parameters for maritime equipment. This guide covers template usage, equipment type selection, and migration from legacy types.

## Available Equipment Types

### Legacy Equipment Types (Backward Compatible)
- `engine` - Generic engine (retained for backward compatibility)
- `pump` - Generic pump
- `compressor` - Generic compressor  
- `generator` - Generic generator
- `hvac` - Generic HVAC system
- `boiler` - Generic boiler

### Marine Propulsion Systems
- **`main_engine`** - Main propulsion engine (slow/medium-speed diesel)
  - 10 sensors: RPM, vibration, bearing temp, exhaust gas temp, cylinder head temp, jacket water temp, lube oil pressure, fuel rail pressure, boost pressure, oil water content
  - High-frequency vibration monitoring (1000 Hz)
  - OEM-aligned thresholds for marine diesel engines
  
- **`auxiliary_engine`** - Auxiliary/generator set prime mover
  - 4 sensors: RPM, vibration, bearing temp, lube oil pressure
  - Lighter monitoring than main engine

### Transmission & Shaftline
- **`gearbox`** - Marine reduction gearbox
  - 4 sensors: Gearmesh vibration (2000 Hz), oil temp, oil pressure, ISO 4406 particle count
  - Specialized gearmesh vibration analysis
  
- **`shaftline`** - Propulsion shaft and thrust bearing
  - 3 sensors: Shaft speed, shaft torque, thrust bearing temp
  - Critical for propulsion efficiency monitoring

### Maneuvering & Auxiliary
- **`thruster_system`** - Bow/stern/azimuth thrusters
  - 5 sensors: Vibration, gearbox oil temp, seal oil water content, pitch angle, motor current
  - Includes hydraulic pitch control monitoring

- **`marine_pump`** - Marine pumps (bilge, ballast, fuel transfer, lube)
  - 5 sensors: Flow rate, discharge pressure, vibration, motor current, suction pressure
  - Enhanced from generic pump with marine-specific parameters

- **`marine_compressor`** - Air compressors
  - 4 sensors: Discharge pressure, discharge temp, vibration, motor current
  - Marine air system optimized thresholds

### Steam & HVAC
- **`marine_boiler`** - Steam boiler and economizer
  - 4 sensors: Steam pressure, feedwater temp, drum level, exhaust gas temp
  - Critical safety monitoring for steam systems

- **`marine_hvac`** - Marine HVAC and AC plant
  - 4 sensors: Space temp, space humidity, chilled water supply temp, compressor current
  - Comfort and equipment efficiency monitoring

### Electrical Systems
- **`marine_generator`** - Marine generator (enhanced)
  - 4 sensors: Voltage, frequency, current, stator winding temp
  - Higher voltage thresholds (380-480V) for marine power
  
- **`electrical_bus`** - Electrical bus and motor control center (MCC)
  - 4 sensors: Bus voltage, bus frequency, harmonic THD, insulation resistance
  - Power quality and electrical safety monitoring

- **`battery_bank`** - Battery banks (UPS/hybrid)
  - 4 sensors: String voltage, string current, battery temp, state of charge (SOC)
  - Essential for hybrid and emergency power systems

## Equipment Type Selection Guide

### When to Use Legacy Types
- **Existing equipment** with established baselines
- **Generic industrial equipment** not specific to marine applications
- **Gradual migration** - maintain existing configs during transition

### When to Use Marine Types
- **New vessel commissions** - start with marine templates from day one
- **Equipment replacement** - upgrade to marine-specific monitoring
- **Higher fidelity needed** - marine templates provide more sensors and tighter thresholds
- **OEM alignment** - marine templates match manufacturer specifications

## Migration Path

### Option 1: Gradual (Recommended)
1. Keep existing equipment with legacy types (`engine`, `pump`, etc.)
2. Add new equipment using marine types (`main_engine`, `marine_pump`, etc.)
3. Migrate critical equipment when convenient:
   ```sql
   UPDATE equipment 
   SET type = 'main_engine' 
   WHERE type = 'engine' AND vessel_id = 'your-vessel-id';
   ```
4. Delete and recreate sensor configurations to apply new templates

### Option 2: Bulk Migration
For operators ready to fully adopt marine templates:
1. Export current sensor baselines and thresholds
2. Update equipment types to marine equivalents
3. Delete existing sensor configurations
4. Allow EquipmentAnalyticsService to auto-generate new configs
5. Import custom thresholds from step 1 (optional)

### Equipment Type Mapping
| Legacy Type | Marine Equivalent | Notes |
|-------------|-------------------|-------|
| `engine` | `main_engine` or `auxiliary_engine` | Choose based on application |
| `pump` | `marine_pump` | Adds suction pressure monitoring |
| `compressor` | `marine_compressor` | Same sensors, marine thresholds |
| `generator` | `marine_generator` | Higher voltage ranges |
| `hvac` | `marine_hvac` | Adds chilled water monitoring |
| `boiler` | `marine_boiler` | Enhanced steam system monitoring |

## Template Customization

### Override Default Thresholds
After equipment creation, update sensor configurations via API:
```typescript
PUT /api/sensor-configurations/:id
{
  "warnHi": 105,  // Custom warning threshold
  "critHi": 115   // Custom critical threshold
}
```

### OEM Baseline Integration
Templates provide conservative defaults. Tune based on:
1. **OEM specifications** - Manufacturer datasheets and manuals
2. **Commissioning data** - Baseline measurements during sea trials
3. **Operating history** - Equipment-specific performance patterns

### Add Custom Sensors
Equipment can have sensors beyond template defaults:
```typescript
POST /api/sensor-configurations
{
  "equipmentId": "your-equipment-id",
  "sensorType": "custom_sensor_type",
  "warnHi": 100,
  "critHi": 120,
  "targetUnit": "your-unit"
}
```

## Sample Rates Explained

### High Frequency (1000-2000 Hz)
- **Vibration monitoring** - Captures machinery dynamics and fault frequencies
- **Gearmesh analysis** - Detects gear wear and misalignment
- Used for: Engines, pumps, compressors, gearboxes, thrusters

### Medium Frequency (1-10 Hz)
- **Temperatures and pressures** - Fast enough to catch transients
- **RPM and torque** - Real-time performance monitoring
- Used for: Most analog sensors on rotating equipment

### Low Frequency (0.1-0.5 Hz)
- **Environmental conditions** - Space temp, humidity
- **Fluid analysis** - Oil water content, particle counts
- **Slow-changing parameters** - Feedwater temp, insulation resistance

## Sensor Type Reference

### Vibration Sensors
- `vibration_overall` - RMS velocity (mm/s)
- `vibration_gearmesh` - Gear-specific vibration analysis (mm/s)

### Temperature Sensors
- `bearing_temperature` - Bearing metal temperature (°C)
- `exhaust_gas_temperature` - Engine exhaust temp (°C)
- `cylinder_head_temperature` - Engine cylinder head temp (°C)
- `jacket_water_temperature` - Coolant temperature (°C)
- `oil_temperature` - Lubricant temperature (°C)
- `discharge_temperature` - Compressor discharge temp (°C)
- `stator_winding_temp` - Generator winding temp (°C)
- `battery_temperature` - Battery cell temperature (°C)

### Pressure Sensors
- `lube_oil_pressure` - Lubricating oil pressure (bar)
- `fuel_rail_pressure` - Fuel injection pressure (bar)
- `boost_pressure` - Turbocharger boost pressure (bar)
- `discharge_pressure` - Pump/compressor discharge (bar)
- `suction_pressure` - Pump suction pressure (bar)
- `steam_pressure` - Boiler steam pressure (bar)

### Electrical Sensors
- `voltage` - AC voltage (V or per-unit)
- `frequency` - AC frequency (Hz)
- `current` - Load current (A or per-unit)
- `motor_current` - Motor load current (per-unit)
- `harmonic_thd` - Total harmonic distortion (%)
- `insulation_resistance` - Megger test (MΩ)

### Performance Sensors
- `rpm` - Rotational speed (rpm or % rated)
- `shaft_speed` - Propeller shaft speed (% rated)
- `shaft_torque` - Propulsion torque (% rated)
- `flow_rate` - Pump flow (L/min)
- `pitch_angle` - Thruster pitch (%)
- `soc` - Battery state of charge (%)

### Fluid Condition Sensors
- `oil_water_content` - Water contamination (ppm)
- `oil_particles_iso_code` - Particle contamination (ISO 4406)
- `drum_level` - Boiler water level (%)

## Best Practices

### 1. Start with Template Defaults
Let ARUS auto-generate sensor configurations, then tune based on operational data.

### 2. Monitor Vibration at High Frequency
Don't reduce vibration sample rates below 1000 Hz - fault detection requires high-frequency data.

### 3. Align with PdM Baselines
Marine templates integrate seamlessly with ARUS predictive maintenance:
- Vibration → Bearing/gear fault detection
- Temperature trends → Thermal degradation
- Pressure deviations → Seal/valve failures

### 4. Document Customizations
If overriding defaults, add notes explaining rationale:
```typescript
{
  "notes": "Threshold raised to 115°C per OEM Technical Bulletin TB-2024-05"
}
```

### 5. Regular Review
Review thresholds quarterly or after:
- Major overhauls
- Equipment modifications
- Operational profile changes (route, cargo, speed)

## Support

For questions or issues with marine sensor templates:
1. Check `server/services/marine-sensor-templates.ts` for template definitions
2. Review `server/equipment-analytics-service.ts` for auto-configuration logic
3. Consult OEM documentation for equipment-specific guidance
4. Contact ARUS support for template customization assistance

## Version History

- **v1.0 (Nov 2025)** - Initial release with 17 marine equipment types and 30+ sensor templates
  - Backward compatible with existing legacy types
  - Modular architecture in `server/services/marine-sensor-templates.ts`
  - Integrated with EquipmentAnalyticsService auto-configuration
