export class PdmDecisionSupportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class EquipmentNotFoundError extends PdmDecisionSupportError {
  constructor(equipmentId: string) {
    super(`Equipment not found: ${equipmentId}`);
  }
}

export class PdmResponseValidationError extends PdmDecisionSupportError {
  constructor(message: string) {
    super(`PdM response validation failed: ${message}`);
  }
}
