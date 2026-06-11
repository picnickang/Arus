# Route Migration and Permission Notes

## Replace/consolidate into Vessel Intelligence

- Fleet technical landing
- Predictive Maintenance / PDM
- Equipment schematic
- Asset/equipment health
- Technical anomaly alerts
- Vessel-linked maintenance
- Vessel-linked expert cases
- Vessel diagnostic/performance reports

## Keep separate

- Crew Management
- Logistics
- Inventory
- Safety Hub and emergency alarms
- System Admin
- User dashboards
- Public landing/login

## Permission mapping

Map legacy view permissions where practical:

```text
fleet:view -> vessel-intelligence:view
pdm:view -> vessel-intelligence:view
equipment-schematic:view -> vessel-intelligence:view
asset-health:view -> vessel-intelligence:view
reports:export -> vessel-intelligence:export-report for vessel reports
maintenance:update -> vessel-intelligence:update-work-order for vessel-linked work orders
```

Do not weaken existing guards.
