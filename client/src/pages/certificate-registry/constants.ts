export const CERT_TYPE_LABELS: Record<string, string> = {
  safety_equipment: "Safety Equipment",
  safety_radio: "Safety Radio",
  safety_construction: "Safety Construction",
  load_line: "Load Line",
  iopp: "IOPP (Oil Pollution Prevention)",
  ispp: "ISPP (Sewage Pollution Prevention)",
  class_machinery: "Class Machinery",
  class_hull: "Class Hull",
  class_electrical: "Class Electrical",
  smc: "SMC (Safety Management)",
  issc: "ISSC (Ship Security)",
  doc: "DOC (Document of Compliance)",
  mlc: "MLC (Maritime Labour)",
  ism: "ISM (Safety Management Code)",
  tonnage: "Tonnage",
  registry: "Registry",
  minimum_safe_manning: "Minimum Safe Manning",
  other: "Other",
};

export const CERT_STATUS_LABELS: Record<string, string> = {
  valid: "Current",
  expired: "Expired",
  suspended: "Suspended",
  withdrawn: "Withdrawn",
  pending_renewal: "Pending Renewal",
};

export const AUTHORITY_TYPE_LABELS: Record<string, string> = {
  class_society: "Class Society",
  flag_state: "Flag State",
  recognized_organization: "Recognized Organization",
  port_state: "Port State",
};

export const PAGE_SIZE = 15;
