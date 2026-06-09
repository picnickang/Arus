import { describe, expect, it } from "@jest/globals";
import { buildFleetSectionEquipmentSummary } from "@/pages/vessel-intelligence/fleet-section-equipment-model";
import { buildFleetTriageViewModel } from "@/pages/vessel-intelligence/fleet-triage-model";
import type {
  EquipmentRecord,
  RegistrySummaryRecord,
  VesselIntelligenceAlertRecord,
  VesselIntelligenceWorkOrderRecord,
  VesselRecord,
} from "@/pages/vessel-intelligence/data";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function summary(): RegistrySummaryRecord {
  return {
    diagrams: [
      {
        id: "diagram-side-elevation",
        diagramType: "side_elevation",
        title: "Side Elevation",
        status: "active",
        activeVersionId: "version-1",
      },
    ],
    sectionMaps: [
      {
        id: "map-1",
        vesselId: "vessel-1",
        name: "Published section map",
        status: "published",
        coordinateMode: "normalized_percent",
        diagramWidth: 1000,
        diagramHeight: 400,
        diagramKind: "side_elevation",
        sections: [
          {
            id: "section-engine",
            sectionKey: "engine_room",
            sectionNo: 4,
            name: "Engine Room",
            color: "#31c48d",
            polygonNormalized: [],
            labelNormalized: { x: 50, y: 50 },
            equipment: [
              {
                id: "assignment-main-engine",
                equipmentId: "main-engine",
                equipmentName: "Main Engine",
                assetCode: "ME-1",
              },
              {
                id: "assignment-registry-only",
                equipmentId: null,
                equipmentName: "Registry Only Pump",
                assetCode: null,
              },
            ],
          },
        ],
      },
    ],
    activeSectionMap: null,
    activeDiagram: null,
    validationIssues: [],
  };
}

describe("buildFleetTriageViewModel", () => {
  it("ranks vessels by operational criticality using real alert and work-order inputs", () => {
    const vessels: VesselRecord[] = [
      { id: "healthy", name: "MV Healthy", status: "active" },
      { id: "critical", name: "MV Critical", status: "active" },
      { id: "warning", name: "MV Warning", status: "active" },
    ];
    const alerts: VesselIntelligenceAlertRecord[] = [
      {
        id: "alert-critical",
        vesselId: "critical",
        title: "Generator vibration deviation",
        severity: "critical",
        status: "open",
      },
    ];
    const workOrders: VesselIntelligenceWorkOrderRecord[] = [
      {
        id: "wo-warning",
        vesselId: "warning",
        title: "Inspect cooling pump",
        status: "open",
        dueDate: "2026-06-08T10:00:00.000Z",
      },
    ];

    const model = buildFleetTriageViewModel({
      vessels,
      equipment: [],
      alerts,
      workOrders,
      summariesByVesselId: {
        healthy: summary(),
        critical: summary(),
        warning: summary(),
      },
      now: NOW,
    });

    expect(model.vessels.map((vessel) => vessel.vesselId)).toEqual([
      "critical",
      "warning",
      "healthy",
    ]);
    expect(model.vessels[0]).toMatchObject({
      status: "warning",
      topIssue: "Generator vibration deviation",
      actionHref: "/vessel-intelligence/critical/alerts",
    });
    expect(model.vessels[1]).toMatchObject({
      topIssue: "Inspect cooling pump",
      actionHref: "/vessel-intelligence/warning/maintenance",
    });
  });

  it("marks missing registry summaries as degraded data instead of fabricating health values", () => {
    const model = buildFleetTriageViewModel({
      vessels: [{ id: "missing", name: "MV Missing" }],
      equipment: [],
      alerts: [],
      workOrders: [],
      summariesByVesselId: {},
      now: NOW,
    });

    expect(model.vessels[0]).toMatchObject({
      status: "missing",
      healthScore: null,
      topIssue: "Vessel intelligence data unavailable",
      hasRegistrySummary: false,
    });
    expect(model.kpis.find((card) => card.id === "avg-health")).toMatchObject({
      value: "No data",
      severity: "missing",
    });
    expect(model.dataFreshnessPercent).toBe(0);
  });

  it("computes global queue counts and freshness from supplied live records", () => {
    const equipment: EquipmentRecord[] = [
      { id: "main-engine", vesselId: "vessel-1", name: "Main Engine", healthStatus: "degraded" },
      { id: "pump", vesselId: "vessel-2", name: "Bilge Pump", healthStatus: "healthy" },
    ];
    const alerts: VesselIntelligenceAlertRecord[] = [
      { id: "a1", vesselId: "vessel-1", severity: "high", status: "open" },
      { id: "a2", vesselId: "vessel-1", severity: "low", status: "closed" },
    ];
    const workOrders: VesselIntelligenceWorkOrderRecord[] = [
      { id: "wo1", vesselId: "vessel-1", status: "open", dueDate: "2026-06-08T12:00:00.000Z" },
      { id: "wo2", vesselId: "vessel-2", status: "open", dueDate: "2026-06-10T12:00:00.000Z" },
      { id: "wo3", vesselId: "vessel-2", status: "completed", dueDate: "2026-06-07T12:00:00.000Z" },
    ];

    const model = buildFleetTriageViewModel({
      vessels: [
        { id: "vessel-1", name: "MV One" },
        { id: "vessel-2", name: "MV Two" },
      ],
      equipment,
      alerts,
      workOrders,
      summariesByVesselId: {
        "vessel-1": summary(),
        "vessel-2": undefined,
      },
      now: NOW,
    });

    expect(Object.fromEntries(model.queue.map((item) => [item.id, item.value]))).toMatchObject({
      "technical-alerts": 1,
      "overdue-work-orders": 1,
      "open-work": 2,
      "missing-data": 1,
    });
    expect(model.dataFreshnessPercent).toBe(50);
  });

  it("produces drill-down action rows with existing Vessel Intelligence route targets", () => {
    const model = buildFleetTriageViewModel({
      vessels: [{ id: "vessel-1", name: "MV Action" }],
      equipment: [
        { id: "engine", vesselId: "vessel-1", name: "Main Engine", healthStatus: "critical" },
      ],
      alerts: [],
      workOrders: [],
      summariesByVesselId: { "vessel-1": summary() },
      now: NOW,
    });

    expect(model.actionRows).toHaveLength(1);
    expect(model.actionRows[0]).toMatchObject({
      actionLabel: "Open section",
      actionHref: "/vessel-intelligence/vessel-1/sections",
      equipmentLabel: "Main Engine",
    });
  });

  it("carries original fleet registry datapoints into triage rows without fabrication", () => {
    const model = buildFleetTriageViewModel({
      vessels: [
        {
          id: "vessel-1",
          name: "MV Explorer",
          vesselClass: "offshore_supply_vessel",
          condition: "good",
          onlineStatus: "online",
          lastHeartbeat: "2026-06-09T10:00:00.000Z",
        },
      ],
      equipment: [
        { id: "main-engine", vesselId: "vessel-1", name: "Main Engine", assetCode: "ME-1" },
      ],
      alerts: [],
      workOrders: [],
      summariesByVesselId: { "vessel-1": summary() },
      now: NOW,
    });

    expect(model.priorityVesselId).toBe("vessel-1");
    expect(model.vessels[0]).toMatchObject({
      vesselClassLabel: "Offshore Supply Vessel",
      conditionLabel: "good",
      onlineStatusLabel: "online",
      lastHeartbeatLabel: "2h ago",
      linkedEquipment: 1,
      sideElevationStatus: "active",
    });
  });

  it("selects the highest-priority vessel for diagram context instead of raw vessel order", () => {
    const model = buildFleetTriageViewModel({
      vessels: [
        { id: "healthy", name: "MV Healthy" },
        { id: "critical", name: "MV Critical" },
      ],
      equipment: [],
      alerts: [
        { id: "critical-alert", vesselId: "critical", severity: "critical", status: "open" },
      ],
      workOrders: [],
      summariesByVesselId: {
        healthy: summary(),
        critical: summary(),
      },
      now: NOW,
    });

    expect(model.vessels[0].vesselId).toBe("critical");
    expect(model.priorityVesselId).toBe("critical");
  });

  it("derives per-section equipment summaries with live and registry-only states", () => {
    const model = buildFleetTriageViewModel({
      vessels: [{ id: "vessel-1", name: "MV Explorer" }],
      equipment: [
        { id: "main-engine", vesselId: "vessel-1", name: "Main Engine", assetCode: "ME-1" },
      ],
      alerts: [],
      workOrders: [],
      summariesByVesselId: { "vessel-1": summary() },
      now: NOW,
    });

    expect(model.vessels[0].sectionEquipmentSummary).toEqual([
      {
        sectionKey: "engine_room",
        sectionName: "Engine Room",
        sectionNo: 4,
        equipment: [
          {
            equipmentId: "main-engine",
            equipmentName: "Main Engine",
            matchStatus: "live",
          },
          {
            equipmentId: null,
            equipmentName: "Registry Only Pump",
            matchStatus: "registry_only",
          },
        ],
      },
    ]);
  });

  it("keeps fleet status plot markers inside the status plot viewBox", () => {
    const vessels = Array.from({ length: 12 }, (_, index) => ({
      id: `vessel-${index + 1}`,
      name: `MV ${index + 1}`,
    }));

    const model = buildFleetTriageViewModel({
      vessels,
      equipment: [],
      alerts: [],
      workOrders: [],
      summariesByVesselId: Object.fromEntries(
        vessels.map((vessel) => [vessel.id, summary()])
      ),
      now: NOW,
    });

    expect(model.markers.length).toBe(vessels.length);
    expect(Math.max(...model.markers.map((marker) => marker.y))).toBeLessThanOrEqual(54);
    expect(Math.min(...model.markers.map((marker) => marker.y))).toBeGreaterThanOrEqual(0);
  });

  it("does not match whitespace-only equipment identifiers to live equipment", () => {
    const baseSummary = summary();
    const whitespaceSummary: RegistrySummaryRecord = {
      ...baseSummary,
      sectionMaps: [
        {
          ...baseSummary.sectionMaps[0],
          sections: [
            {
              ...baseSummary.sectionMaps[0].sections[0],
              equipment: [
                {
                  id: "assignment-whitespace",
                  equipmentId: "   ",
                  equipmentName: "Unmatched Registry Pump",
                  assetCode: "  ",
                },
              ],
            },
          ],
        },
      ],
    };

    const sectionSummary = buildFleetSectionEquipmentSummary(whitespaceSummary, [
      {
        id: "   ",
        equipmentId: "",
        assetCode: " ",
        tagNumber: " ",
        vesselId: "vessel-1",
        name: "Different Live Equipment",
      },
    ]);

    expect(sectionSummary[0].equipment).toEqual([
      {
        equipmentId: "   ",
        equipmentName: "Unmatched Registry Pump",
        matchStatus: "registry_only",
      },
    ]);
  });
});
