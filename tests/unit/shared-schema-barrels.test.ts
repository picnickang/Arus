import { describe, expect, it } from "@jest/globals";
import * as logbooks from "../../shared/schema/logbooks";
import * as mlAdvanced from "../../shared/schema/ml-analytics-advanced";
import * as alerts from "../../shared/schema/alerts";
import * as schemaRuntime from "../../shared/schema-runtime.ts";

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
});
