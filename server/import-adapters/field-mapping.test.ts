import { describe, expect, it } from "@jest/globals";
import {
  EQUIPMENT_FIELD_MAP,
  MAINTENANCE_PLAN_FIELD_MAP,
  PARTS_FIELD_MAP,
  WORK_ORDER_FIELD_MAP,
  applyMapping,
} from "./amos/field-mapping.js";
import {
  SHIPMATE_CREW_CERT_MAP,
  SHIPMATE_EQUIPMENT_MAP,
  SHIPMATE_JOB_MAP,
  SHIPMATE_REST_HOURS_MAP,
  SHIPMATE_STORES_MAP,
  getShipmateMapping,
  normalizeShipmateHeaders,
} from "./shipmate/field-mapping.js";

describe("AMOS field mapping", () => {
  it("maps equipment fields with dates, booleans, criticality, specs, and required validation", () => {
    const mapped = applyMapping(
      {
        EQUIPMENT_NO: "ME-01",
        DESCRIPTION: "Main Engine",
        LONG_DESCRIPTION: " Port propulsion engine ",
        CRITICALITY: "A",
        PARENT_EQUIPMENT_NO: "PROP",
        INSTALL_DATE: "15/01/2024",
        WARRANTY_EXPIRY: "2027-01-15",
        RUNNING_HOURS: "1234,5",
        IS_ACTIVE: "yes",
        POWER_KW: "1200,5",
        DIMENSIONS: " compact ",
      },
      EQUIPMENT_FIELD_MAP
    );

    expect(mapped.errors).toEqual([]);
    expect(mapped.data).toMatchObject({
      id: "ME-01",
      name: "Main Engine",
      plainLanguageName: "Port propulsion engine",
      criticalityLevel: "critical",
      parentEquipmentId: "PROP",
      _spec_runningHours: 1234.5,
      isActive: true,
      _spec_powerKw: 1200.5,
      _spec_dimensions: "compact",
    });
    expect(String(mapped.data["_spec_installDate"])).toContain("2024-01-15");
    expect(String(mapped.data["_spec_warrantyExpiry"])).toContain("2027-01-15");

    const invalid = applyMapping({ DESCRIPTION: "" }, EQUIPMENT_FIELD_MAP);
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        "Required field EQUIPMENT_NO is missing or empty",
        "Required field DESCRIPTION is missing or empty",
      ])
    );
  });

  it("maps work orders, parts, and maintenance plans with defaults and fallback transforms", () => {
    const workOrder = applyMapping(
      {
        JOB_ORDER_NO: "WO-1",
        DESCRIPTION: "Replace purifier seals",
        EQUIPMENT_NO: "PUR-1",
        STATUS: "IN-PROGRESS",
        MAINTENANCE_TYPE: "BREAKDOWN",
        PRIORITY: "not-a-number",
        PLANNED_START_DATE: "01.02.2026",
        PLANNED_HOURS: "8,5",
      },
      WORK_ORDER_FIELD_MAP
    );
    expect(workOrder.errors).toEqual([]);
    expect(workOrder.data).toMatchObject({
      woNumber: "WO-1",
      description: "Replace purifier seals",
      equipmentId: "PUR-1",
      status: "in_progress",
      maintenanceType: "corrective",
      priority: 3,
      estimatedHours: 8.5,
    });

    const part = applyMapping(
      {
        PART_NO: "KIT-01",
        DESCRIPTION: "Seal kit",
        UOM: "",
        STANDARD_COST: "bad",
        LEAD_TIME_DAYS: "14",
        CRITICALITY: "4",
        CURRENT_STOCK: "2,5",
        LOCATION: "",
      },
      PARTS_FIELD_MAP
    );
    expect(part.data).toMatchObject({
      partNo: "KIT-01",
      name: "Seal kit",
      unitOfMeasure: "ea",
      standardCost: 0,
      leadTimeDays: 14,
      criticality: "low",
      _stock_quantityOnHand: 2.5,
      _stock_location: "MAIN",
    });

    const plan = applyMapping(
      {
        PLAN_CODE: "PM-01",
        DESCRIPTION: "Monthly inspection",
        EQUIPMENT_NO: "ME-01",
        MAINTENANCE_TYPE: "PD",
        LAST_DONE_DATE: "2026-01-01",
        NEXT_DUE_DATE: "bad-date",
        ESTIMATED_HOURS: "3",
      },
      MAINTENANCE_PLAN_FIELD_MAP
    );
    expect(plan.data).toMatchObject({
      templateCode: "PM-01",
      title: "Monthly inspection",
      equipmentId: "ME-01",
      maintenanceType: "predictive",
      nextDueDate: null,
      estimatedHours: 3,
    });
  });

  it("records transform warnings and applies default values when a transform throws", () => {
    const mapped = applyMapping({ THROW_ME: "bad" }, [
      {
        amosField: "THROW_ME",
        arusField: "safeValue",
        defaultValue: "fallback",
        transform: () => {
          throw new Error("boom");
        },
      },
    ]);

    expect(mapped).toMatchObject({
      data: { safeValue: "fallback" },
      errors: [],
    });
    expect(mapped.warnings[0]).toContain("Failed to transform THROW_ME");
  });
});

describe("SHIPMATE field mapping", () => {
  it("normalizes common CSV headers and selects every supported module mapping", () => {
    expect(
      normalizeShipmateHeaders([
        " comp. no ",
        "job no.",
        "r.o.b.",
        "completion date",
        "deck/location",
        "unknown header",
      ])
    ).toEqual([
      "Component No",
      "Job No",
      "ROB",
      "Completed Date",
      "Deck/Location",
      "unknown header",
    ]);

    expect(getShipmateMapping("pms_equipment")).toBe(SHIPMATE_EQUIPMENT_MAP);
    expect(getShipmateMapping("pms_jobs")).toBe(SHIPMATE_JOB_MAP);
    expect(getShipmateMapping("sps_stores")).toBe(SHIPMATE_STORES_MAP);
    expect(getShipmateMapping("cms_crew_certs")).toBe(SHIPMATE_CREW_CERT_MAP);
    expect(getShipmateMapping("cms_rest_hours")).toBe(SHIPMATE_REST_HOURS_MAP);
    expect(() => getShipmateMapping("unknown" as never)).toThrow("Unknown SHIPMATE module");
  });

  it("maps SHIPMATE equipment hierarchy, criticality, dates, running hours, and status", () => {
    const mapped = applyMapping(
      {
        "Component No": "1.2.3",
        "Component Name": "Main Engine Jacket Pump",
        Description: " Cooling water pump ",
        System: "Cooling",
        Criticality: "Essential",
        "Vessel Name": "ARUS Trader",
        "Install Date": "15-Jan-2024",
        "Last Done Date": "01/02/2026",
        "Running Hours": "4,523.5",
        Status: "Y",
        "Power (kW)": "75",
      },
      SHIPMATE_EQUIPMENT_MAP
    );

    expect(mapped.errors).toEqual([]);
    expect(mapped.data).toMatchObject({
      id: "1.2.3",
      name: "Main Engine Jacket Pump",
      description: "Cooling water pump",
      parentEquipmentId: "1.2",
      systemType: "Cooling",
      criticalityLevel: "high",
      _vesselName: "ARUS Trader",
      runningHours: 4523.5,
      isActive: true,
      _spec_powerKw: 75,
    });
    expect(mapped.data["installDate"]).toBeInstanceOf(Date);
    expect(mapped.data["lastMaintenanceDate"]).toBeInstanceOf(Date);
  });

  it("maps SHIPMATE jobs, stores, crew certificates, and rest-hour records", () => {
    const job = applyMapping(
      {
        "Job No": "GB-PM-0001",
        "Job Name": "Generator oil change",
        "Component No": "1.2",
        "Job Type": "CBM",
        "Job Status": "Closed Out",
        Priority: "2",
        "Due Date": "2026-06-10",
        "Actual Hours": "6.5",
        Responsible: "2/E",
      },
      SHIPMATE_JOB_MAP
    );
    expect(job.errors).toEqual([]);
    expect(job.data).toMatchObject({
      woNumber: "GB-PM-0001",
      title: "Generator oil change",
      equipmentId: "1.2",
      maintenanceType: "predictive",
      status: "closed",
      priority: 2,
      actualHours: 6.5,
      assignedTo: "2/E",
    });

    const store = applyMapping(
      {
        "Part No": "SEAL-01",
        "Part Name": "Pump seal",
        ROB: "1,250",
        "Min Stock": "2",
        "Unit Price": "19.5",
        Hazmat: "No",
        "IMDG Class": "9",
      },
      SHIPMATE_STORES_MAP
    );
    expect(store.data).toMatchObject({
      partNo: "SEAL-01",
      name: "Pump seal",
      _stock_quantityOnHand: 1250,
      minStockQty: 2,
      _stock_unitCost: 19.5,
      isHazmat: false,
      imoDgClass: "9",
    });

    const cert = applyMapping(
      {
        "Employee No": "E-1",
        Name: "Ana Chief",
        "Certificate Name": "CoC",
        "Issue Date": "01-Mar-2024",
        "Expiry Date": "01/03/2029",
      },
      SHIPMATE_CREW_CERT_MAP
    );
    expect(cert.data).toMatchObject({
      employeeId: "E-1",
      employeeName: "Ana Chief",
      certificateName: "CoC",
    });
    expect(cert.data["issueDate"]).toBeInstanceOf(Date);
    expect(cert.data["expiryDate"]).toBeInstanceOf(Date);

    const rest = applyMapping(
      {
        "Employee No": "E-1",
        Name: "Ana Chief",
        Date: "2026-06-08",
        "Work Hours": "13",
        "Rest Hours": "11",
        Violation: "Active",
      },
      SHIPMATE_REST_HOURS_MAP
    );
    expect(rest.data).toMatchObject({
      employeeId: "E-1",
      employeeName: "Ana Chief",
      workHours: 13,
      restHours: 11,
      hasViolation: true,
    });
  });
});
