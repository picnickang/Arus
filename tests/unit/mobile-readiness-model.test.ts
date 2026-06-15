import { describe, expect, it } from "@jest/globals";
import {
  buildMobileReadinessNavigation,
  buildMobileReadinessNavigationForVariant,
  buildMobileReadinessScreens,
  normalizeMobileRole,
  severityRank,
} from "@/features/mobile-readiness/mobile-readiness-model";

describe("mobile readiness replacement model", () => {
  it("uses role-specific mobile navigation from the Figma reference instead of the legacy generic nav", () => {
    expect(buildMobileReadinessNavigation("admin").map((item) => item.label)).toEqual([
      "Command",
      "Vessels",
      "Tasks",
      "Reports",
      "Settings",
    ]);
    expect(buildMobileReadinessNavigation("captain").map((item) => item.label)).toEqual([
      "Bridge",
      "Logs",
      "Crew",
      "Maintenance",
      "Settings",
    ]);
    expect(buildMobileReadinessNavigation("crew").map((item) => item.label)).toEqual([
      "My Tasks",
      "Logs",
      "Safety",
      "Documents",
      "Settings",
    ]);
    expect(normalizeMobileRole("maintenance_technician")).toBe("crew");
    expect(normalizeMobileRole("maintenance_planner")).toBe("chief_engineer");
    expect(normalizeMobileRole("procurement_user")).toBe("logistics");
  });

  it("maps admin and regular-user aliases to distinct mobile queues and nav labels", () => {
    expect(normalizeMobileRole("system_admin")).toBe("admin");
    expect(normalizeMobileRole("deck_officer")).toBe("captain");
    expect(normalizeMobileRole("crew_member")).toBe("crew");
    expect(normalizeMobileRole("viewer")).toBe("crew");

    expect(buildMobileReadinessScreens("system_admin").today.queueLabel).toBe("Command Queue");
    expect(buildMobileReadinessScreens("deck_officer").today.queueLabel).toBe("Command Queue");
    expect(buildMobileReadinessScreens("crew_member").today.queueLabel).toBe("My Queue");
    expect(buildMobileReadinessScreens("viewer").today.queueLabel).toBe("My Queue");

    expect(buildMobileReadinessNavigation("system_admin").map((item) => item.label)).toEqual([
      "Command",
      "Vessels",
      "Tasks",
      "Reports",
      "Settings",
    ]);
    expect(buildMobileReadinessNavigation("deck_officer").map((item) => item.label)).toEqual([
      "Bridge",
      "Logs",
      "Crew",
      "Maintenance",
      "Settings",
    ]);
    expect(buildMobileReadinessNavigation("deck_officer").at(-1)).toMatchObject({
      href: "/profile",
    });
    expect(buildMobileReadinessNavigation("crew_member").map((item) => item.label)).toEqual([
      "My Tasks",
      "Logs",
      "Safety",
      "Documents",
      "Settings",
    ]);
    expect(
      buildMobileReadinessNavigation("crew_member").find((item) => item.id === "documents")
    ).toMatchObject({
      href: "/profile",
    });
  });

  it("switches bottom-nav variants to match board-specific route groups", () => {
    expect(
      buildMobileReadinessNavigationForVariant("fleetOps", "admin").map((item) => item.label)
    ).toEqual(["Fleet", "Work", "Attention", "Crew", "Inventory", "Settings"]);
    expect(
      buildMobileReadinessNavigationForVariant("fleetOps", "admin").map((item) => item.href)
    ).toEqual([
      "/fleet",
      "/work-orders",
      "/attention-inbox",
      "/crew-management",
      "/logistics",
      "/system",
    ]);
    expect(
      buildMobileReadinessNavigationForVariant("technician", "crew").map((item) => item.label)
    ).toEqual(["My Tasks", "Logs", "Safety", "Documents", "Settings"]);
    expect(
      buildMobileReadinessNavigationForVariant("fleetOps", "deck_officer").map((item) => item.href)
    ).toEqual(["/", "/logs", "/crew-management", "/pdm-platform", "/profile"]);
    expect(
      buildMobileReadinessNavigationForVariant("machineryOps", "chief_engineer").map(
        (item) => item.label
      )
    ).toEqual(["Today", "Machinery", "Work", "Logs", "Settings"]);
    expect(
      buildMobileReadinessNavigationForVariant("crewOps", "logistics").map((item) => item.label)
    ).toEqual(["Home", "Crew", "Inventory", "Work", "Compliance", "Settings"]);
  });

  it("sorts operational attention cards by severity without hiding evidence context", () => {
    const screens = buildMobileReadinessScreens("admin");

    expect(screens.today.queueLabel).toBe("Command Queue");
    expect(screens.today.items.map((item) => item.title)).toEqual([
      "Engine room fire alarm",
      "Port Generator vibration",
      "Chief Engineer certificate expired",
      "Fuel filter unavailable",
      "Oil Record Book overdue",
      "Offline - sync pending",
      "ISM task overdue",
    ]);
    expect(
      screens.today.items.every(
        (item) => item.reason.length > 0 && item.owner.length > 0 && item.action.length > 0
      )
    ).toBe(true);
    expect(severityRank("critical")).toBeGreaterThan(severityRank("high"));
  });

  it("preserves role-board Today queue order instead of severity sorting every role", () => {
    expect(buildMobileReadinessScreens("captain").today.items.map((item) => item.title)).toEqual([
      "Vessel readiness - Good",
      "Required log sign-off",
      "Active alert",
      "Crew readiness",
      "Weather & condition log",
    ]);
    expect(buildMobileReadinessScreens("captain").today.items.map((item) => item.href)).toEqual([
      "/fleet",
      "/logs",
      "/logs/compliance",
      "/crew-management",
      "/logs",
    ]);
    expect(buildMobileReadinessScreens("crew").today.items.map((item) => item.title)).toEqual([
      "Clean bilge holding tank",
      "Daily Engine Log (Draft)",
      "Safety instruction",
      "Medical certificate expiring",
      "Offline draft",
    ]);
    expect(buildMobileReadinessScreens("crew").today.items.map((item) => item.href)).toEqual([
      "/my-tasks",
      "/logs",
      "/logs/compliance",
      "/profile",
      "/logs",
    ]);
  });

  it("builds fleet cards with thumbnails, readiness KPIs, telemetry trust, log status, and next action", () => {
    const screens = buildMobileReadinessScreens("admin");

    expect(screens.fleet.summary.map((item) => item.label)).toEqual([
      "Vessels",
      "High risk",
      "Alarms",
      "Overdue",
    ]);
    expect(screens.fleet.vessels[0]).toMatchObject({
      name: "MV Atlas",
      route: "Singapore -> Rotterdam",
      operationalState: "At sea",
      pdmRiskScore: 82,
      nextAction: "A/E LO purifier service overdue",
      assetId: "vessel-atlas",
    });
    expect(screens.fleet.vessels[0].kpis.map((kpi) => kpi.label)).toEqual([
      "Readiness",
      "Alarms",
      "Overdue",
      "Crew",
      "Logs",
      "Trust",
    ]);
    expect(screens.fleet.vesselDetail.diagramAssetId).toBe("diagram-side-elevation");
  });

  it("keeps telemetry as evidence while exposing a specialist PdM risk queue and advanced data", () => {
    const screens = buildMobileReadinessScreens("chief_engineer");

    expect(screens.pdm.riskQueue[0]).toMatchObject({
      equipmentId: "port-generator",
      asset: "Port Generator",
      riskState: "High Risk",
      riskScore: 62,
      sourceHealth: "Fresh",
      action: "Inspect within 48h",
    });
    expect(screens.pdm.assetCase.evidenceSections.map((section) => section.title)).toEqual([
      "Why at Risk?",
      "Latest Abnormal Readings",
      "Recommended Next Action",
      "Linked Work Order",
      "Parts Likely Needed",
      "Responsible",
      "Evidence & Notes",
    ]);
    expect(screens.pdm.telemetryAdvanced).toMatchObject({
      trust: "Good",
      confidence: 92,
      lastUpdate: "2m ago",
      rawReadingsAvailable: true,
      sensorHealthCount: 4,
      chartAssetId: "telemetry-risk-chart",
    });
  });

  it("replaces legacy work and logs screens with queue stages, execution checklist, and daily log trust", () => {
    const screens = buildMobileReadinessScreens("crew");

    expect(screens.work.stageChips.map((chip) => chip.label)).toEqual([
      "Intake",
      "Triage",
      "Assigned",
      "In Progress",
      "Blocked",
    ]);
    expect(screens.work.queue.map((item) => item.href)).toEqual([
      "/work-orders/sr-1258",
      "/work-orders/so-4476",
      "/work-orders/so-4481",
      "/work-orders/sr-1266",
      "/work-orders/sr-1271",
    ]);
    expect(screens.work.execution).toMatchObject({
      orderNumber: "SO-4481",
      vesselName: "M/V Ocean Pioneer",
      assetId: "vessel-borealis",
      priority: "Medium",
      syncState: "Syncing...",
    });
    expect(screens.work.execution.checklistProgress).toBe("4 / 6");
    expect(screens.work.execution.photoAssetIds).toEqual([
      "work-compressor",
      "work-motor",
      "work-gauge",
    ]);
    expect(screens.work.execution.offlineDraftAction).toBe("Save Draft Offline");
    expect(screens.logs.autofillTrust.map((item) => item.label)).toEqual([
      "Fresh",
      "Delayed",
      "Manual Required",
    ]);
    expect(screens.logs.requiredCards.map((card) => card.title)).toEqual([
      "Engine Log",
      "Deck Watch Entry",
      "Condition Log",
      "Captain Signoff",
    ]);
    expect(screens.logs.complianceRows.map((row) => row.status)).toEqual([
      "Signed",
      "Signed",
      "Signed",
    ]);
  });

  it("moves admin and governance controls into mobile settings while keeping crew and inventory action-first", () => {
    const screens = buildMobileReadinessScreens("admin");

    expect(screens.crew.readiness.find((item) => item.label === "Missing Roles")).toMatchObject({
      value: "2",
      tone: "critical",
    });
    expect(screens.inventory.actionRequired.map((item) => item.label)).toEqual([
      "Reorder Needed",
      "Low Stock",
      "Deliveries",
      "Linked to WO",
    ]);
    expect(screens.inventory.rows).toHaveLength(5);
    expect(screens.inventory.rows.at(-1)).toMatchObject({
      partNumber: "500-700-200",
      name: "Bearing BRG-700",
      reorderStatus: "OK",
    });
    expect(screens.inventory.linkedWorkOrders[0]).toMatchObject({
      id: "WO-2025-1348",
      status: "3 items",
    });
    expect(screens.inventory.logisticsTasks[0]).toMatchObject({
      id: "DEL-2025-0891",
      eta: "ETA: 16 May 2025",
    });
    expect(screens.settings.items.map((item) => item.label)).toEqual([
      "Profile",
      "Switch Portal / Organization",
      "Notifications",
      "Offline Sync",
      "System Configuration",
      "Sensors + Telemetry Setup",
      "Integrations",
      "Roles + Hub Access",
      "Copilot + Knowledge Base Settings",
      "System Health",
    ]);
    expect(screens.crew.currentCrew.map((person) => person.avatarAssetId)).toEqual([
      "avatar-michael",
      "avatar-sarah",
      "avatar-daniel",
    ]);
    expect(screens.crew.formerCrew[0]).toMatchObject({
      name: "James Williams",
      avatarAssetId: "avatar-alex",
    });
    expect(screens.settings.profile.avatarAssetId).toBe("avatar-alex");
  });
});
