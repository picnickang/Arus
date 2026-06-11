import {
  BUNKERING_REGISTER_MAP,
  DEFAULT_FMCC_REGISTER_MAP,
} from "../../server/integrations/fmcc-types";
import { createDomainEvent } from "../../server/lib/domain-event-bus/types";

describe("server public contract barrels", () => {
  it("keeps domain event factory exports available from the public types module", () => {
    const event = createDomainEvent(
      "rms.alert_triggered",
      "org-a",
      {
        alertLogId: "alert-1",
        vesselId: "vessel-1",
        alertType: "fuel_threshold",
        severity: "warning",
        title: "Fuel threshold",
        message: "Main engine flow exceeded threshold",
      },
      {
        aggregateId: "alert-1",
        aggregateType: "rms_alert",
        correlationId: "corr-1",
      }
    );

    expect(event).toMatchObject({
      eventType: "rms.alert_triggered",
      orgId: "org-a",
      payload: {
        alertLogId: "alert-1",
        vesselId: "vessel-1",
        alertType: "fuel_threshold",
      },
      aggregateId: "alert-1",
      aggregateType: "rms_alert",
      correlationId: "corr-1",
    });
    expect(event.eventId).toEqual(expect.any(String));
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it("keeps FMCC register catalog exports available from the public module", () => {
    expect(DEFAULT_FMCC_REGISTER_MAP.length).toBeGreaterThan(20);
    expect(DEFAULT_FMCC_REGISTER_MAP).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          register: 100,
          targetField: "fuel.mainEngineFlowKgPerH",
          dataType: "float32",
        }),
        expect.objectContaining({
          register: 528,
          targetField: "tanks.doSettlingVolumeM3",
          dataType: "float32",
        }),
      ])
    );
    expect(BUNKERING_REGISTER_MAP.every((entry) => entry.targetField.startsWith("fuel."))).toBe(
      true
    );
  });
});
