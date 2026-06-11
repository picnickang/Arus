import { describe, expect, it } from "@jest/globals";
import * as logbooks from "../../shared/schema/logbooks";
import * as mlAdvanced from "../../shared/schema/ml-analytics-advanced";
import * as alerts from "../../shared/schema/alerts";
import * as schemaRuntime from "../../shared/schema-runtime.ts";
import * as crewSchema from "../../shared/schema/crew";
import * as equipmentSchema from "../../shared/schema/equipment";
import * as purchasingSchema from "../../shared/schema/purchasing";

describe("shared schema barrels", () => {
  it("keeps logbook tables, constants, and insert schemas on the public module", () => {
    expect(logbooks.deckLogDaily).toBeDefined();
    expect(logbooks.deckLogHourly).toBeDefined();
    expect(logbooks.deckLogEvents).toBeDefined();
    expect(logbooks.engineLogDaily).toBeDefined();
    expect(logbooks.engineLogHourly).toBeDefined();
    expect(logbooks.engineLogEvents).toBeDefined();
    expect(logbooks.deckLogHourlyAutoFill).toBeDefined();
    expect(logbooks.fuelEmissionsLog).toBeDefined();
    expect(logbooks.vesselTrackLog).toBeDefined();
    expect(logbooks.conditionLogSummary).toBeDefined();
    expect(logbooks.DECK_LOG_EVENT_TYPES.WEATHER_OBSERVATION).toBe("WEATHER_OBSERVATION");
    expect(logbooks.ENGINE_LOG_EVENT_TYPES.MAINTENANCE_START).toBe("MAINTENANCE_START");
    expect(typeof logbooks.insertDeckLogDailySchema.parse).toBe("function");
    expect(typeof logbooks.insertEngineLogDailySchema.parse).toBe("function");
    expect(typeof logbooks.insertFuelEmissionsLogSchema.parse).toBe("function");
  });

  it("keeps advanced ML tables and insert schemas on the public module", () => {
    expect(mlAdvanced.modelPerformanceValidations).toBeDefined();
    expect(mlAdvanced.predictionFeedback).toBeDefined();
    expect(mlAdvanced.vibrationFeatures).toBeDefined();
    expect(mlAdvanced.rulModels).toBeDefined();
    expect(mlAdvanced.pdmBaseline).toBeDefined();
    expect(mlAdvanced.realTimePredictions).toBeDefined();
    expect(mlAdvanced.featureImportances).toBeDefined();
    expect(mlAdvanced.digitalTwins).toBeDefined();
    expect(mlAdvanced.modelRegistry).toBeDefined();
    expect(mlAdvanced.inferenceRuns).toBeDefined();
    expect(mlAdvanced.predictionOutcomes).toBeDefined();
    expect(typeof mlAdvanced.insertModelPerformanceValidationSchema.parse).toBe("function");
    expect(typeof mlAdvanced.insertRealTimePredictionSchema.parse).toBe("function");
    expect(typeof mlAdvanced.insertDigitalTwinSchema.parse).toBe("function");
    expect(typeof mlAdvanced.insertPredictionOutcomeSchema.parse).toBe("function");
  });

  it("keeps alert tables, queues, and insert schemas on the public module", () => {
    expect(alerts.alertConfigurations).toBeDefined();
    expect(alerts.alertNotifications).toBeDefined();
    expect(alerts.alertSuppressions).toBeDefined();
    expect(alerts.actionableInsights).toBeDefined();
    expect(alerts.alertSettings).toBeDefined();
    expect(alerts.alertSettingsVessel).toBeDefined();
    expect(alerts.alertThresholds).toBeDefined();
    expect(alerts.alertEmailLog).toBeDefined();
    expect(alerts.crewAlertSettings).toBeDefined();
    expect(alerts.alertCooldown).toBeDefined();
    expect(alerts.emailQueue).toBeDefined();
    expect(alerts.notificationSettings).toBeDefined();
    expect(alerts.notificationQueue).toBeDefined();
    expect(alerts.alertThresholdCategoryEnum).toContain("machinery");
    expect(typeof alerts.insertAlertConfigSchema.parse).toBe("function");
    expect(typeof alerts.insertAlertSettingsSchema.parse).toBe("function");
    expect(typeof alerts.insertEmailQueueSchema.parse).toBe("function");
    expect(typeof alerts.insertNotificationQueueSchema.parse).toBe("function");
  });

  it("keeps schema-runtime mode helpers, tables, and validators on the public module", () => {
    expect(["VESSEL", "CLOUD"]).toContain(schemaRuntime.DEPLOYMENT_MODE);
    expect(typeof schemaRuntime.IS_SQLITE).toBe("boolean");
    expect(typeof schemaRuntime.IS_POSTGRES).toBe("boolean");
    expect(schemaRuntime.organizations).toBeDefined();
    expect(schemaRuntime.equipment).toBeDefined();
    expect(schemaRuntime.workOrders).toBeDefined();
    expect("notificationSettings" in schemaRuntime).toBe(true);
    expect("notificationQueue" in schemaRuntime).toBe(true);
    expect("emailQueue" in schemaRuntime).toBe(true);
    expect(typeof schemaRuntime.insertEquipmentSchema.parse).toBe("function");
    expect(typeof schemaRuntime.insertAlertNotificationSchema.parse).toBe("function");
    expect(typeof schemaRuntime.vesselIdSchema.parse).toBe("function");
  });

  it("keeps crew tables, constants, and insert schemas on the public module", () => {
    expect(crewSchema.crew).toBeDefined();
    expect(crewSchema.crewEmploymentHistory).toBeDefined();
    expect(crewSchema.crewNotificationSettings).toBeDefined();
    expect(crewSchema.crewAlerts).toBeDefined();
    expect(crewSchema.crewRoles).toBeDefined();
    expect(crewSchema.skills).toBeDefined();
    expect(crewSchema.crewSkill).toBeDefined();
    expect(crewSchema.crewAssignment).toBeDefined();
    expect(crewSchema.crewDocuments).toBeDefined();
    expect(crewSchema.crewRestSheet).toBeDefined();
    expect(crewSchema.crewRestDay).toBeDefined();
    expect(crewSchema.CREW_DOCUMENT_TYPE_VALUES).toContain("passport");
    expect(typeof crewSchema.insertCrewSchema.parse).toBe("function");
    expect(typeof crewSchema.insertCrewRoleSchema.parse).toBe("function");
    expect(typeof crewSchema.insertCrewDocumentSchema.parse).toBe("function");
    expect(typeof crewSchema.insertCrewRestDaySchema.parse).toBe("function");
  });

  it("keeps equipment tables and insert schemas on the public module", () => {
    expect(equipmentSchema.equipment).toBeDefined();
    expect(equipmentSchema.devices).toBeDefined();
    expect(equipmentSchema.edgeHeartbeats).toBeDefined();
    expect(equipmentSchema.pdmScoreLogs).toBeDefined();
    expect(equipmentSchema.equipmentLifecycle).toBeDefined();
    expect(equipmentSchema.performanceMetrics).toBeDefined();
    expect(equipmentSchema.equipmentDecommissionEvents).toBeDefined();
    expect(equipmentSchema.downtimeEvents).toBeDefined();
    expect(equipmentSchema.partFailureHistory).toBeDefined();
    expect(equipmentSchema.industryBenchmarks).toBeDefined();
    expect(equipmentSchema.operatingParameters).toBeDefined();
    expect(equipmentSchema.operatingConditionAlerts).toBeDefined();
    expect(typeof equipmentSchema.insertEquipmentSchema.parse).toBe("function");
    expect(typeof equipmentSchema.insertDecommissionEventSchema.parse).toBe("function");
    expect(typeof equipmentSchema.insertDowntimeEventSchema.parse).toBe("function");
    expect(typeof equipmentSchema.decommissionReasonEnum.parse).toBe("function");
  });

  it("keeps purchasing tables and insert schemas on the public module", () => {
    expect(purchasingSchema.reservations).toBeDefined();
    expect(purchasingSchema.purchaseOrders).toBeDefined();
    expect(purchasingSchema.purchaseOrderItems).toBeDefined();
    expect(purchasingSchema.purchaseRequests).toBeDefined();
    expect(purchasingSchema.purchaseRequestItems).toBeDefined();
    expect(purchasingSchema.itemSuppliers).toBeDefined();
    expect(purchasingSchema.serviceRequests).toBeDefined();
    expect(purchasingSchema.serviceOrders).toBeDefined();
    expect(purchasingSchema.serviceOrderEvents).toBeDefined();
    expect(typeof purchasingSchema.insertReservationSchema.parse).toBe("function");
    expect(typeof purchasingSchema.insertPurchaseRequestSchema.parse).toBe("function");
    expect(typeof purchasingSchema.insertServiceOrderSchema.parse).toBe("function");
  });
});
