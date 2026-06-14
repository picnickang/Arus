import { COMMON_PII_PATTERNS } from "./pii-fields.js";

const TIMESTAMP_FIELD_PATTERNS = [
  "createdAt",
  "updatedAt",
  "deletedAt",
  "timestamp",
  "ts",
  "startDate",
  "endDate",
  "date",
  "lastModified",
  "expiryDate",
  "issuedDate",
  "validFrom",
  "validTo",
  "scheduledDate",
];

const TECHNICAL_FIELD_PATTERNS = [
  "type",
  "status",
  "priority",
  "category",
  "level",
  "role",
  "port",
  "protocol",
  "version",
  "mode",
  "config",
  "setting",
  "threshold",
  "limit",
  "count",
  "quantity",
  "value",
  "score",
  "rating",
  "temperature",
  "pressure",
  "speed",
  "rpm",
  "voltage",
];

const NESTED_PII_KEYWORDS = [
  "operator",
  "technician",
  "crew",
  "person",
  "user",
  "uploaded",
  "created",
  "modified",
  "assigned",
  "approved",
  "comment",
  "annotation",
  "note",
  "remark",
  "message",
];

const NESTED_PII_SUFFIXES = ["info", "data", "details", "metadata"];
const PHONE_FIELD_PATTERNS = ["phone", "mobile", "tel", "fax", "contact"];
const NAME_FIELD_PATTERNS = [
  "name",
  "first",
  "last",
  "author",
  "reviewer",
  "technician",
  "assignee",
];
const ADDRESS_FIELD_PATTERNS = ["address", "street", "city", "state", "country", "postal", "zip"];
const IDENTIFIER_FIELD_PATTERNS = [
  "passport",
  "license",
  "certificate",
  "registration",
  "seaman",
  "ssn",
  "tax",
];

const includesPattern = (field: string, patterns: readonly string[]) => {
  const lowerField = field.toLowerCase();
  return patterns.some((pattern) => lowerField.includes(pattern.toLowerCase()));
};

export function isTimestampField(field: string): boolean {
  return includesPattern(field, TIMESTAMP_FIELD_PATTERNS);
}

export function isTechnicalField(field: string): boolean {
  return includesPattern(field, TECHNICAL_FIELD_PATTERNS);
}

export function isEmailField(field: string): boolean {
  return field.toLowerCase().includes("email");
}

export function isPhoneField(field: string): boolean {
  return includesPattern(field, PHONE_FIELD_PATTERNS);
}

export function isNameField(field: string): boolean {
  return includesPattern(field, NAME_FIELD_PATTERNS);
}

export function isAddressField(field: string): boolean {
  return includesPattern(field, ADDRESS_FIELD_PATTERNS);
}

export function isIdentifierField(field: string): boolean {
  return includesPattern(field, IDENTIFIER_FIELD_PATTERNS);
}

export function isSensitiveFieldName(field: string): boolean {
  return (
    isEmailField(field) ||
    isPhoneField(field) ||
    isNameField(field) ||
    isAddressField(field) ||
    isIdentifierField(field) ||
    COMMON_PII_PATTERNS.some((pattern) => pattern.test(field))
  );
}

export function isNestedPiiKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    NESTED_PII_KEYWORDS.some((keyword) => lowerKey.includes(keyword)) ||
    NESTED_PII_SUFFIXES.some((suffix) => lowerKey.endsWith(suffix))
  );
}

export function isPotentialPiiField(field: string): boolean {
  if (isSensitiveFieldName(field)) {
    return true;
  }
  if (isTechnicalField(field) || isTimestampField(field)) {
    return false;
  }
  if (field.endsWith("Id") || field === "id" || field.endsWith("_id")) {
    return false;
  }
  return isNestedPiiKey(field) || COMMON_PII_PATTERNS.some((pattern) => pattern.test(field));
}

export function isLikelyPiiString(value: string): boolean {
  if (value.length < 3 || value.length > 500) {
    return false;
  }
  if (looksLikeEmail(value)) {
    return true;
  }
  if (looksLikePhone(value)) {
    return true;
  }
  const namePattern = /^[A-Z][a-z]{1,20} [A-Z][a-z]{1,20}$/;
  return namePattern.test(value);
}

function looksLikeEmail(value: string): boolean {
  const atPositions = findAllAtPositions(value);
  return atPositions.some((atIdx) => isValidEmailAtPosition(value, atIdx));
}

function findAllAtPositions(value: string): number[] {
  const positions: number[] = [];
  let i = value.indexOf("@");
  while (i !== -1) {
    positions.push(i);
    i = value.indexOf("@", i + 1);
  }
  return positions;
}

function isValidEmailAtPosition(value: string, atIdx: number): boolean {
  const localStart = findLocalStart(value, atIdx);
  const domainEnd = findDomainEnd(value, atIdx);
  if (localStart >= atIdx || domainEnd <= atIdx + 1) {
    return false;
  }
  const local = value.slice(localStart, atIdx);
  const domain = value.slice(atIdx + 1, domainEnd);
  return local.length >= 1 && local.length <= 64 && domain.includes(".") && domain.length >= 3;
}

function findLocalStart(s: string, atIdx: number): number {
  let i = atIdx - 1;
  while (i >= 0 && /[a-zA-Z0-9._%+-]/.test(s[i] ?? "")) {
    i--;
  }
  return i + 1;
}

function findDomainEnd(s: string, atIdx: number): number {
  let i = atIdx + 1;
  while (i < s.length && /[a-zA-Z0-9.-]/.test(s[i] ?? "")) {
    i++;
  }
  return i;
}

function looksLikePhone(value: string): boolean {
  const digits = value.replaceAll(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
