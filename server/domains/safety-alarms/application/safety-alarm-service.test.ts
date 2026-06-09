import { describe, expect, it } from "@jest/globals";
import { AlarmValidationError, SafetyAlarmApplicationService } from "./safety-alarm-service.js";
import type { ISafetyAlarmRepository } from "../domain/ports.js";
import type {
  AcknowledgeAlarmCommand,
  CreateAlarmTypeCommand,
  ListAlarmsFilters,
  SafetyAlarmAckEntity,
  SafetyAlarmEntity,
  SafetyAlarmTypeEntity,
  SafetyAlarmWithAcks,
  TriggerAlarmCommand,
  UpdateAlarmTypeCommand,
  UserAlarmScope,
} from "../domain/types.js";

const orgId = "org-safety";
const now = new Date("2026-06-08T12:00:00Z");

function alarmType(overrides: Partial<SafetyAlarmTypeEntity> = {}): SafetyAlarmTypeEntity {
  return {
    id: "type-1",
    orgId,
    key: "engine_room_watch",
    displayName: "Engine Room Watch",
    description: "Engine room operational alarm",
    defaultSeverity: "warning",
    icon: "bell",
    color: "#f59e0b",
    requiresAcknowledgement: true,
    isProtected: false,
    isActive: true,
    createdBy: "admin-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function alarm(overrides: Partial<SafetyAlarmEntity> = {}): SafetyAlarmEntity {
  return {
    id: "alarm-1",
    orgId,
    alarmTypeId: "type-1",
    vesselId: "vessel-1",
    title: "Engine Room Watch",
    message: "Investigate temperature rise",
    severity: "warning",
    mode: "real",
    status: "active",
    requiresAcknowledgement: true,
    triggeredBy: "captain-1",
    triggeredByName: "Captain",
    triggeredAt: now,
    clearedBy: null,
    clearedByName: null,
    clearedAt: null,
    resolutionNote: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class RecordingSafetyAlarmRepository implements ISafetyAlarmRepository {
  readonly types = new Map<string, SafetyAlarmTypeEntity>();
  readonly alarms = new Map<string, SafetyAlarmEntity>();
  readonly acknowledgements: SafetyAlarmAckEntity[] = [];
  ensureCalls = 0;
  lastFilters: ListAlarmsFilters | undefined;
  lastScope: UserAlarmScope | undefined;
  lastClear:
    | {
        orgId: string;
        id: string;
        clearedBy: string | undefined;
        clearedByName: string | undefined;
        resolutionNote: string | undefined;
      }
    | undefined;

  constructor(types: SafetyAlarmTypeEntity[] = [], alarms: SafetyAlarmEntity[] = []) {
    for (const type of types) {
      this.types.set(type.id, type);
    }
    for (const currentAlarm of alarms) {
      this.alarms.set(currentAlarm.id, currentAlarm);
    }
  }

  async ensureProtectedTypes(requestedOrgId: string): Promise<void> {
    if (requestedOrgId === orgId) {
      this.ensureCalls += 1;
    }
  }

  async findTypes(
    requestedOrgId: string,
    includeInactive?: boolean
  ): Promise<SafetyAlarmTypeEntity[]> {
    return [...this.types.values()].filter(
      (type) => type.orgId === requestedOrgId && (includeInactive || type.isActive)
    );
  }

  async findTypeById(
    requestedOrgId: string,
    id: string
  ): Promise<SafetyAlarmTypeEntity | undefined> {
    const type = this.types.get(id);
    return type?.orgId === requestedOrgId ? type : undefined;
  }

  async createType(command: CreateAlarmTypeCommand): Promise<SafetyAlarmTypeEntity> {
    const created = alarmType({
      id: `type-${this.types.size + 1}`,
      orgId: command.orgId,
      key: command.key,
      displayName: command.displayName,
      description: command.description ?? null,
      defaultSeverity: command.defaultSeverity ?? "warning",
      icon: command.icon ?? null,
      color: command.color ?? null,
      requiresAcknowledgement: command.requiresAcknowledgement ?? true,
      createdBy: command.createdBy ?? null,
    });
    this.types.set(created.id, created);
    return created;
  }

  async updateType(
    requestedOrgId: string,
    id: string,
    patch: UpdateAlarmTypeCommand
  ): Promise<SafetyAlarmTypeEntity | undefined> {
    const existing = await this.findTypeById(requestedOrgId, id);
    if (!existing) {
      return undefined;
    }
    const updated: SafetyAlarmTypeEntity = {
      ...existing,
      ...patch,
      description: patch.description ?? existing.description,
      icon: patch.icon ?? existing.icon,
      color: patch.color ?? existing.color,
      updatedAt: new Date("2026-06-08T13:00:00Z"),
    };
    this.types.set(id, updated);
    return updated;
  }

  async deactivateType(requestedOrgId: string, id: string): Promise<void> {
    const existing = await this.findTypeById(requestedOrgId, id);
    if (existing) {
      this.types.set(id, { ...existing, isActive: false });
    }
  }

  async findAlarms(
    requestedOrgId: string,
    filters?: ListAlarmsFilters
  ): Promise<SafetyAlarmWithAcks[]> {
    this.lastFilters = filters;
    return [...this.alarms.values()]
      .filter(
        (currentAlarm) =>
          currentAlarm.orgId === requestedOrgId &&
          (filters?.includeCleared || currentAlarm.status !== "cleared") &&
          (!filters?.vesselId || currentAlarm.vesselId === filters.vesselId)
      )
      .map((currentAlarm) => ({
        ...currentAlarm,
        acknowledgements: this.acknowledgements.filter((ack) => ack.alarmId === currentAlarm.id),
      }));
  }

  async findActiveAlarmsForScope(
    requestedOrgId: string,
    scope: UserAlarmScope
  ): Promise<SafetyAlarmWithAcks[]> {
    this.lastScope = scope;
    return this.findAlarms(requestedOrgId, { includeCleared: false }).then((alarms) =>
      alarms.filter(
        (currentAlarm) =>
          currentAlarm.vesselId === null ||
          scope.fleetWide ||
          scope.vesselIds.includes(currentAlarm.vesselId)
      )
    );
  }

  async findAlarmById(requestedOrgId: string, id: string): Promise<SafetyAlarmEntity | undefined> {
    const currentAlarm = this.alarms.get(id);
    return currentAlarm?.orgId === requestedOrgId ? currentAlarm : undefined;
  }

  async trigger(command: TriggerAlarmCommand): Promise<SafetyAlarmEntity> {
    const triggered = alarm({
      id: `alarm-${this.alarms.size + 1}`,
      orgId: command.orgId,
      alarmTypeId: command.alarmTypeId,
      vesselId: command.vesselId ?? null,
      title: command.title ?? "Untitled alarm",
      message: command.message ?? null,
      severity: command.severity ?? "warning",
      mode: command.mode ?? "real",
      requiresAcknowledgement: command.requiresAcknowledgement ?? true,
      triggeredBy: command.triggeredBy ?? null,
      triggeredByName: command.triggeredByName ?? null,
    });
    this.alarms.set(triggered.id, triggered);
    return triggered;
  }

  async clear(
    requestedOrgId: string,
    id: string,
    clearedBy: string | undefined,
    clearedByName: string | undefined,
    resolutionNote: string | undefined
  ): Promise<SafetyAlarmEntity | undefined> {
    this.lastClear = { orgId: requestedOrgId, id, clearedBy, clearedByName, resolutionNote };
    const currentAlarm = await this.findAlarmById(requestedOrgId, id);
    if (!currentAlarm) {
      return undefined;
    }
    const cleared: SafetyAlarmEntity = {
      ...currentAlarm,
      status: "cleared",
      clearedBy: clearedBy ?? null,
      clearedByName: clearedByName ?? null,
      clearedAt: new Date("2026-06-08T14:00:00Z"),
      resolutionNote: resolutionNote ?? null,
    };
    this.alarms.set(id, cleared);
    return cleared;
  }

  async acknowledge(command: AcknowledgeAlarmCommand): Promise<SafetyAlarmAckEntity> {
    const ack: SafetyAlarmAckEntity = {
      id: `ack-${this.acknowledgements.length + 1}`,
      orgId: command.orgId,
      alarmId: command.alarmId,
      userId: command.userId,
      userName: command.userName ?? null,
      source: command.source ?? null,
      comment: command.comment ?? null,
      acknowledgedAt: new Date("2026-06-08T15:00:00Z"),
    };
    this.acknowledgements.push(ack);
    return ack;
  }
}

function serviceWith(
  types: SafetyAlarmTypeEntity[] = [alarmType()],
  alarms: SafetyAlarmEntity[] = []
): {
  service: SafetyAlarmApplicationService;
  repository: RecordingSafetyAlarmRepository;
} {
  const repository = new RecordingSafetyAlarmRepository(types, alarms);
  return {
    service: new SafetyAlarmApplicationService(repository),
    repository,
  };
}

async function expectAlarmError(action: Promise<unknown>, code: string): Promise<void> {
  await expect(action).rejects.toMatchObject({ name: "AlarmValidationError", code });
}

describe("SafetyAlarmApplicationService", () => {
  it("seeds protected types before listing and respects inactive filtering", async () => {
    const active = alarmType({ id: "active", isActive: true });
    const inactive = alarmType({ id: "inactive", key: "old_type", isActive: false });
    const { service, repository } = serviceWith([active, inactive]);

    await expect(service.listTypes(orgId)).resolves.toEqual([active]);
    await expect(service.listTypes(orgId, true)).resolves.toEqual([active, inactive]);
    expect(repository.ensureCalls).toBe(2);
  });

  it("normalizes custom alarm keys and rejects reserved or blank keys", async () => {
    const { service, repository } = serviceWith([]);

    const created = await service.createType({
      orgId,
      key: "  Machinery Space  ",
      displayName: "Machinery Space",
      requiresAcknowledgement: false,
    });

    expect(created).toMatchObject({
      key: "machinery_space",
      requiresAcknowledgement: false,
    });
    expect(repository.types.get(created.id)).toEqual(created);
    await expectAlarmError(
      service.createType({ orgId, key: "fire_alarm", displayName: "Fire" }),
      "RESERVED_KEY"
    );
    await expectAlarmError(
      service.createType({ orgId, key: "   ", displayName: "Blank" }),
      "INVALID_KEY"
    );
  });

  it("locks protected alarm identity while allowing display styling changes", async () => {
    const protectedType = alarmType({
      id: "protected",
      key: "fire_alarm",
      displayName: "Fire Alarm",
      defaultSeverity: "emergency",
      requiresAcknowledgement: true,
      isProtected: true,
    });
    const { service } = serviceWith([protectedType]);

    const updated = await service.updateType(orgId, protectedType.id, {
      displayName: "Illegal rename",
      defaultSeverity: "info",
      requiresAcknowledgement: false,
      color: "#dc2626",
      icon: "flame",
      isActive: false,
    });

    expect(updated).toMatchObject({
      id: protectedType.id,
      displayName: "Fire Alarm",
      defaultSeverity: "emergency",
      requiresAcknowledgement: true,
      color: "#dc2626",
      icon: "flame",
      isActive: false,
    });
    await expectAlarmError(service.deleteType(orgId, protectedType.id), "PROTECTED_TYPE");
  });

  it("updates and deactivates custom alarm types but fails missing records", async () => {
    const type = alarmType({ id: "custom" });
    const { service, repository } = serviceWith([type]);

    await expect(
      service.updateType(orgId, type.id, {
        displayName: "Engine Room Rounds",
        defaultSeverity: "critical",
        requiresAcknowledgement: false,
      })
    ).resolves.toMatchObject({
      displayName: "Engine Room Rounds",
      defaultSeverity: "critical",
      requiresAcknowledgement: false,
    });
    await service.deleteType(orgId, type.id);
    expect(repository.types.get(type.id)).toMatchObject({ isActive: false });
    await expectAlarmError(service.updateType(orgId, "missing", {}), "NOT_FOUND");
    await expectAlarmError(service.deleteType(orgId, "missing"), "NOT_FOUND");
  });

  it("requires confirmation for serious real alarms and inherits type defaults on trigger", async () => {
    const type = alarmType({
      defaultSeverity: "critical",
      requiresAcknowledgement: false,
    });
    const { service, repository } = serviceWith([type]);

    await expectAlarmError(
      service.triggerAlarm({ orgId, alarmTypeId: type.id, vesselId: "vessel-1" }, false),
      "CONFIRMATION_REQUIRED"
    );
    const drill = await service.triggerAlarm(
      { orgId, alarmTypeId: type.id, vesselId: "vessel-1", mode: "drill" },
      false
    );
    const real = await service.triggerAlarm(
      {
        orgId,
        alarmTypeId: type.id,
        vesselId: "vessel-2",
        severity: "emergency",
        title: "Manual emergency",
      },
      true
    );

    expect(drill).toMatchObject({
      title: type.displayName,
      severity: "critical",
      mode: "drill",
      requiresAcknowledgement: false,
    });
    expect(real).toMatchObject({
      title: "Manual emergency",
      severity: "emergency",
      vesselId: "vessel-2",
    });
    expect(repository.alarms.size).toBe(2);
    await expectAlarmError(
      service.triggerAlarm({ orgId, alarmTypeId: "missing" }, true),
      "TYPE_NOT_FOUND"
    );
  });

  it("requires resolution notes for serious real alarms but not warnings or drills", async () => {
    const serious = alarm({ id: "serious", severity: "emergency", mode: "real" });
    const warning = alarm({ id: "warning", severity: "warning", mode: "real" });
    const drill = alarm({ id: "drill", severity: "emergency", mode: "drill" });
    const { service, repository } = serviceWith([alarmType()], [serious, warning, drill]);

    await expectAlarmError(
      service.clearAlarm(orgId, "serious", "admin-1", "Admin", "  "),
      "RESOLUTION_NOTE_REQUIRED"
    );
    await expect(service.clearAlarm(orgId, "warning", "admin-1", "Admin")).resolves.toMatchObject({
      status: "cleared",
      clearedBy: "admin-1",
    });
    await expect(service.clearAlarm(orgId, "drill", undefined, undefined)).resolves.toMatchObject({
      status: "cleared",
    });
    await expect(
      service.clearAlarm(orgId, "serious", "captain-1", "Captain", "Crew mustered and safe")
    ).resolves.toMatchObject({
      status: "cleared",
      resolutionNote: "Crew mustered and safe",
    });
    expect(repository.lastClear).toMatchObject({
      id: "serious",
      resolutionNote: "Crew mustered and safe",
    });
    await expectAlarmError(service.clearAlarm(orgId, "missing", undefined, undefined), "NOT_FOUND");
  });

  it("enforces vessel scope when acknowledging alarms and allows fleet-wide alarms", async () => {
    const scoped = alarm({ id: "scoped", vesselId: "vessel-1" });
    const outOfScope = alarm({ id: "out-of-scope", vesselId: "vessel-9" });
    const fleetWide = alarm({ id: "fleet-wide", vesselId: null });
    const { service, repository } = serviceWith([alarmType()], [scoped, outOfScope, fleetWide]);
    const scope: UserAlarmScope = { fleetWide: false, vesselIds: ["vessel-1"] };

    await expect(
      service.acknowledge(
        { orgId, alarmId: "scoped", userId: "chief", userName: "Chief", source: "mobile" },
        scope
      )
    ).resolves.toMatchObject({ alarmId: "scoped", userId: "chief", source: "mobile" });
    await expect(
      service.acknowledge({ orgId, alarmId: "fleet-wide", userId: "watch" }, scope)
    ).resolves.toMatchObject({ alarmId: "fleet-wide" });
    await expectAlarmError(
      service.acknowledge({ orgId, alarmId: "out-of-scope", userId: "chief" }, scope),
      "OUT_OF_SCOPE"
    );
    await expectAlarmError(
      service.acknowledge({ orgId, alarmId: "missing", userId: "chief" }, scope),
      "NOT_FOUND"
    );
    expect(repository.acknowledgements.map((ack) => ack.alarmId)).toEqual(["scoped", "fleet-wide"]);
  });

  it("delegates alarm list and active-scope reads to the repository", async () => {
    const active = alarm({ id: "active", vesselId: "vessel-1" });
    const cleared = alarm({ id: "cleared", vesselId: "vessel-1", status: "cleared" });
    const other = alarm({ id: "other", vesselId: "vessel-2" });
    const { service, repository } = serviceWith([alarmType()], [active, cleared, other]);

    await expect(service.listAlarms(orgId, { vesselId: "vessel-1" })).resolves.toEqual([
      { ...active, acknowledgements: [] },
    ]);
    await expect(
      service.listActiveForUser(orgId, { vesselIds: ["vessel-2"], fleetWide: false })
    ).resolves.toEqual([{ ...other, acknowledgements: [] }]);

    expect(repository.lastFilters).toEqual({ includeCleared: false });
    expect(repository.lastScope).toEqual({ vesselIds: ["vessel-2"], fleetWide: false });
    expect(service.isAlarmInScope({ vesselId: null }, { vesselIds: [], fleetWide: false })).toBe(
      true
    );
    expect(
      service.isAlarmInScope({ vesselId: "vessel-1" }, { vesselIds: [], fleetWide: true })
    ).toBe(true);
    expect(
      service.isAlarmInScope(
        { vesselId: "vessel-1" },
        { vesselIds: ["vessel-2"], fleetWide: false }
      )
    ).toBe(false);
  });

  it("exposes validation errors with stable codes for route layers", async () => {
    const error = new AlarmValidationError("Nope", "NOPE");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AlarmValidationError");
    expect(error.code).toBe("NOPE");
  });
});
