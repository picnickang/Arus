# Marine Terminology Reference
**Date**: November 25, 2025  
**Purpose**: Standard marine industry terminology for ARUS predictive maintenance system  
**Status**: ✅ Active Reference

---

## Overview

This document establishes the standard marine terminology used throughout ARUS. Following marine industry standards ensures clarity for ship crew, marine engineers, and fleet operators.

---

## Core Marine Terminology

### Vessel Components

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **Main Engine** | Primary Motor, Main Motor | Propulsion engine |
| **Auxiliary Engine** | Secondary Engine, Helper Engine | Generators, support systems |
| **Bow Thruster** | Front Propeller, Forward Thruster | Forward maneuvering device |
| **Stern Thruster** | Aft Thruster, Rear Propeller | Aft maneuvering device |
| **Generator** | Gen Set, Power Unit | Acceptable as "GenSet" in logs |
| **Fuel Oil System** | Fuel System | Marine standard |
| **Lube Oil System** | Lubrication System | Marine standard |
| **Cooling Water System** | Coolant System | Freshwater/Seawater cooling |
| **Air Compressor** | Air Pump | Compressed air system |
| **Hydraulic System** | Hydraulic Pump | For cranes, hatches, etc. |

### Vessel Locations

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **Engine Room** | Machinery Space, Machine Room | Primary machinery area |
| **Bridge** | Control Room, Wheelhouse | Navigation and command center |
| **Deck** | Top Side, Upper Area | Working deck area |
| **Cargo Hold** | Storage Area, Cargo Bay | Cargo storage compartment |
| **Pump Room** | Pumping Station | Cargo/ballast pump area |
| **Steering Gear Room** | Rudder Room | Steering mechanism area |
| **Accommodation** | Living Quarters, Cabins | Crew living spaces |
| **Galley** | Kitchen | Ship's kitchen |
| **Forecastle (Fo'c'sle)** | Front Area | Forward superstructure |
| **Aft (Stern)** | Rear, Back | Rear of vessel |
| **Port Side** | Left Side | Left when facing forward |
| **Starboard Side** | Right Side | Right when facing forward |
| **Amidships** | Middle, Center | Middle of vessel |

### Vessel Operations

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **Underway** | In Transit, Moving | Vessel is moving |
| **At Anchor** | Anchored, Stopped | Vessel secured by anchor |
| **Berthed** | Docked, Moored | Secured to pier/wharf |
| **Maneuvering** | Docking, Moving Slowly | Low-speed operations |
| **Sea Passage** | Ocean Transit | Open sea navigation |
| **Harbor Operations** | Port Operations | Operations in port |
| **Dynamic Positioning (DP)** | Station Keeping | Computer-controlled positioning |
| **Dead Slow Ahead** | Very Slow Forward | Minimum ahead speed |
| **Full Ahead** | Maximum Speed | Maximum propulsion |
| **Stop Engine** | Engine Off | Engine stopped |

### Equipment Status

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **Running** | Operating, Active | Equipment in operation |
| **Standby** | Ready, Idle | Ready but not running |
| **Stopped** | Off, Inactive | Equipment not running |
| **Out of Service** | Broken, Down | Not available for use |
| **Under Maintenance** | Being Repaired | Maintenance in progress |
| **Secured** | Locked Out, Isolated | Isolated for safety |

### Marine Engineering Terms

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **RPM** | Revolutions, Speed | Revolutions Per Minute |
| **Knots** | Speed, MPH | Nautical miles per hour |
| **Bar** | PSI | Pressure (1 bar ≈ 14.5 PSI) |
| **°C** | °F | Temperature (Celsius standard) |
| **Kg** | Pounds | Mass/Weight (metric) |
| **Liters** | Gallons | Volume (metric) |
| **kW** | Horsepower | Power (kilowatts standard) |
| **Fuel Oil** | Diesel, Gas | Marine fuel terminology |
| **Lube Oil** | Motor Oil, Lubricant | Lubrication oil |
| **Bilge** | Drain Water | Accumulated water in hull |

### Maintenance & Operations

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **PMS (Planned Maintenance System)** | Maintenance Schedule | Industry standard term |
| **Running Hours** | Operating Time | Equipment operation duration |
| **Service Interval** | Maintenance Period | Time between services |
| **Overhaul** | Major Repair | Complete equipment rebuild |
| **Breakdown** | Failure, Malfunction | Unexpected equipment failure |
| **Class Survey** | Inspection | Classification society survey |
| **Dry Dock** | Shipyard Visit | Vessel out of water for maintenance |

### Crew Roles (Maritime Standard)

| ✅ Use This | ❌ Not This | Notes |
|---|---|---|
| **Chief Engineer** | Engineering Manager | Senior engineering officer |
| **Second Engineer** | Assistant Engineer | Second-in-command engineering |
| **Third Engineer** | Junior Engineer | Engineering watch officer |
| **Fourth Engineer** | Entry Level Engineer | Junior engineering officer |
| **Deck Officer** | Navigation Officer | Bridge watch officer |
| **Able Seaman (AB)** | Deckhand | Experienced deck crew |
| **Ordinary Seaman (OS)** | Deck Worker | Entry-level deck crew |
| **Electrician** | Electrical Officer | Electrical systems specialist |
| **Fitter** | Mechanic | Mechanical repair specialist |
| **Wiper** | Engine Room Cleaner | Engine room maintenance crew |

---

## Equipment Type Standards

### ARUS Equipment Classifications

These equipment types are used throughout ARUS and align with marine industry standards:

```typescript
// From client/src/constants/equipment.ts
export const EQUIPMENT_TYPES = [
  "engine",        // Main Engine, Auxiliary Engine
  "pump",          // Various pumps (fuel, lube oil, water, bilge)
  "compressor",    // Air compressors
  "generator",     // Electrical generators
  "gearbox",       // Reduction gearbox, shaft gearbox
  "thruster",      // Bow thruster, stern thruster
  "crane",         // Deck cranes, cargo cranes
  "winch",         // Mooring winch, cargo winch
  "boiler",        // Steam boiler, exhaust gas boiler
  "hvac",          // Heating, ventilation, air conditioning
  "navigation",    // Navigation equipment (radar, GPS, AIS)
  "communication", // Radio, satellite communication
  "safety",        // Fire detection, life-saving equipment
  "other"          // Other marine equipment
];
```

### Equipment Location Standards

```typescript
// From client/src/constants/equipment.ts
export const EQUIPMENT_LOCATIONS = [
  "engine_room",    // Main machinery space
  "deck",           // Working deck
  "bridge",         // Navigation bridge
  "cargo_hold",     // Cargo compartment
  "pump_room",      // Pump room (cargo/ballast)
  "steering_gear",  // Steering gear room
  "accommodation",  // Living quarters
  "galley",         // Kitchen
  "workshop",       // Ship's workshop
  "other"           // Other locations
];
```

---

## Operational Modes

Marine vessels operate in distinct modes that affect equipment usage and maintenance schedules:

| Mode | Description | Equipment Profile |
|---|---|---|
| **DP (Dynamic Positioning)** | Computer-controlled station keeping | High thruster usage, constant power |
| **Transit** | En route to destination | Main engine running, normal loads |
| **Harbor** | In port, berthed | Auxiliary systems, reduced loads |
| **Maneuvering** | Entering/leaving port | Variable loads, thruster usage |
| **At Anchor** | Anchored offshore | Reduced power, standby systems |
| **Idle** | Engine stopped, vessel stationary | Minimal systems running |
| **Full Sea** | Ocean passage | Optimized for fuel efficiency |
| **Cargo Operations** | Loading/unloading | Cargo handling equipment active |

---

## Sensor & Measurement Standards

### Common Marine Sensors

| Sensor Type | Unit | Marine Standard Range |
|---|---|---|
| Engine RPM | RPM | 0-3000 RPM |
| Engine Temperature | °C | 60-95°C (normal operating) |
| Lube Oil Pressure | Bar | 2.5-5 bar (typical) |
| Fuel Oil Pressure | Bar | 5-10 bar (injection) |
| Coolant Temperature | °C | 70-90°C |
| Vibration | mm/s RMS | <7 mm/s (acceptable) |
| Exhaust Temperature | °C | 300-450°C |
| Turbocharger RPM | RPM | 10,000-25,000 RPM |
| Generator Frequency | Hz | 50 Hz or 60 Hz |
| Generator Voltage | V | 440V (3-phase typical) |

---

## Compliance & Regulatory Terms

### Classification Societies

- **DNV GL** (Det Norske Veritas - Germanischer Lloyd)
- **ABS** (American Bureau of Shipping)
- **Lloyd's Register**
- **Bureau Veritas**
- **ClassNK** (Nippon Kaiji Kyokai)

### Key Regulations

- **SOLAS** (Safety of Life at Sea)
- **MARPOL** (Marine Pollution)
- **ISM Code** (International Safety Management)
- **STCW** (Standards of Training, Certification and Watchkeeping)
- **MLC** (Maritime Labour Convention)

---

## UI/UX Guidelines

### When to Use Marine Terminology

1. **Primary Labels** - Always use marine terms (Main Engine, not Motor)
2. **Navigation** - Use familiar marine terms (Vessel, Fleet, Equipment)
3. **Equipment Names** - Follow marine conventions
4. **Status Messages** - Use operational terms (Underway, Berthed, Running)
5. **Reports** - Industry-standard terminology for audits and compliance

### When Generic Terms Are Acceptable

1. **Common Actions** - "Save", "Cancel", "Delete" (not "Secure", "Belay")
2. **UI Controls** - "Button", "Menu", "Toggle" (standard UI terms)
3. **Data Formats** - "CSV", "JSON", "PDF" (technical file formats)
4. **Software Concepts** - "Database", "API", "Cache" (technical terms)

### Tooltips & Help Text

For marine-specific terms, provide tooltips to help users:

```typescript
<HelpTooltip content="Dynamic Positioning: Computer-controlled station keeping using thrusters" />
```

Example tooltips needed:
- **DP Mode**: "Dynamic Positioning - automated station keeping"
- **RUL**: "Remaining Useful Life - predicted time until maintenance required"
- **DTC**: "Diagnostic Trouble Code - equipment fault code"
- **Running Hours**: "Total operational hours since last overhaul"
- **Class Survey**: "Inspection by classification society (e.g., DNV, ABS)"

---

## Implementation Checklist

### Phase 1: Audit ✅
- [x] Review existing equipment types - Already marine-standard
- [x] Review existing location types - Already marine-standard
- [x] Review navigation labels - Mostly correct
- [x] Review UI component labels - To be reviewed

### Phase 2: Documentation ✅
- [x] Create marine terminology reference (this document)
- [ ] Add inline tooltips for marine-specific terms
- [ ] Create user guide section on marine terminology

### Phase 3: Gradual Improvement
- [ ] Add marine term tooltips to equipment pages
- [ ] Add glossary to help/documentation section
- [ ] Add term validation for custom equipment names
- [ ] Create marine terminology quick reference card

### Phase 4: Quality Assurance
- [ ] User testing with marine engineers
- [ ] Terminology consistency audit across all pages
- [ ] Compliance with marine industry standards

---

## References

1. **IMO (International Maritime Organization)** - Marine terminology standards
2. **DNV GL** - Classification society terminology
3. **SOLAS Convention** - Safety of Life at Sea regulations
4. **Marine Engineering Textbooks** - Standard reference materials
5. **Industry Best Practices** - Fleet management systems

---

## Maintenance

This document should be updated when:
- New equipment types are added to ARUS
- User feedback suggests terminology improvements
- Marine industry standards are updated
- New features require additional terminology

**Last Updated**: November 25, 2025  
**Next Review**: March 2026
