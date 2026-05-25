/**
 * Data Anonymization Service - Main Service Class
 * GDPR/PDPA-compliant data anonymization with deterministic pseudonymization
 */

import * as crypto from "node:crypto";
import type { AnonymizationConfig, AnonymizationResult, AnonymizationReport } from "./types.js";
import { PII_FIELDS, COMMON_PII_PATTERNS, PARTIAL_ANONYMIZE_FIELDS } from "./pii-fields.js";

export class DataAnonymizationService {
  private readonly salt: string;
  private readonly pseudonymCache: Map<string, string> = new Map();

  constructor(salt?: string) {
    this.salt = salt || crypto.randomBytes(16).toString("hex");
  }
  getSalt(): string {
    return this.salt;
  }
  clearCache(): void {
    this.pseudonymCache.clear();
  }
  getDefaultConfig(): AnonymizationConfig {
    return {
      level: "none",
      preserveIds: true,
      preserveTimestamps: true,
      preserveTechnicalData: true,
      salt: this.salt,
    };
  }

  anonymizeRecord<T extends Record<string, unknown>>(
    record: T,
    entityName: string,
    config: AnonymizationConfig
  ): { record: T; result: AnonymizationResult } {
    if (config.level === "none") {
      return {
        record,
        result: {
          originalFieldCount: Object.keys(record).length,
          anonymizedFieldCount: 0,
          skippedFieldCount: 0,
        },
      };
    }
    const anonymized = { ...record };
    const processedFields = new Set<string>();
    const fieldsToAnonymize =
      config.level === "full"
        ? PII_FIELDS[entityName] || []
        : PARTIAL_ANONYMIZE_FIELDS[entityName] || [];
    let { anonymizedCount, skippedCount } = this.processDefinedFields(
      anonymized,
      fieldsToAnonymize,
      entityName,
      config,
      processedFields
    );
    if (config.level === "full") {
      const additionalCounts = this.processRemainingFields(
        anonymized,
        entityName,
        config,
        processedFields
      );
      anonymizedCount += additionalCounts.anonymizedCount;
      skippedCount += additionalCounts.skippedCount;
    }
    return {
      record: anonymized,
      result: {
        originalFieldCount: Object.keys(record).length,
        anonymizedFieldCount: anonymizedCount,
        skippedFieldCount: skippedCount,
      },
    };
  }

  private processDefinedFields<T extends Record<string, unknown>>(
    anonymized: T,
    fields: string[],
    entityName: string,
    config: AnonymizationConfig,
    processedFields: Set<string>
  ): { anonymizedCount: number; skippedCount: number } {
    let anonymizedCount = 0,
      skippedCount = 0;
    for (const field of fields) {
      if (!(field in anonymized) || anonymized[field] == null) {
        continue;
      }
      processedFields.add(field);
      if (this.shouldSkipField(field, config)) {
        skippedCount++;
        continue;
      }
      (anonymized as Record<string, unknown>)[field] = this.anonymizeField(
        field,
        anonymized[field],
        entityName
      );
      anonymizedCount++;
    }
    return { anonymizedCount, skippedCount };
  }

  private processRemainingFields<T extends Record<string, unknown>>(
    anonymized: T,
    entityName: string,
    config: AnonymizationConfig,
    processedFields: Set<string>
  ): { anonymizedCount: number; skippedCount: number } {
    let anonymizedCount = 0,
      skippedCount = 0;
    for (const [field, value] of Object.entries(anonymized)) {
      if (processedFields.has(field) || value == null) {
        continue;
      }
      if (this.shouldSkipField(field, config)) {
        skippedCount++;
        continue;
      }
      if (this.isPotentialPiiField(field)) {
        (anonymized as Record<string, unknown>)[field] = this.anonymizeField(
          field,
          value,
          entityName
        );
        anonymizedCount++;
        processedFields.add(field);
      }
    }
    return { anonymizedCount, skippedCount };
  }

  anonymizeDataset<T extends Record<string, unknown>>(
    records: T[],
    entityName: string,
    config: AnonymizationConfig
  ): { records: T[]; totalResult: AnonymizationResult } {
    const anonymizedRecords: T[] = [];
    const totalResult: AnonymizationResult = {
      originalFieldCount: 0,
      anonymizedFieldCount: 0,
      skippedFieldCount: 0,
    };
    for (const record of records) {
      const { record: anonymized, result } = this.anonymizeRecord(record, entityName, config);
      anonymizedRecords.push(anonymized);
      totalResult.originalFieldCount += result.originalFieldCount;
      totalResult.anonymizedFieldCount += result.anonymizedFieldCount;
      totalResult.skippedFieldCount += result.skippedFieldCount;
    }
    return { records: anonymizedRecords, totalResult };
  }

  private shouldSkipField(field: string, config: AnonymizationConfig): boolean {
    if (config.preserveIds && (field.endsWith("Id") || field === "id")) {
      return true;
    }
    if (config.preserveTimestamps && this.isTimestampField(field)) {
      return true;
    }
    if (config.preserveTechnicalData && this.isTechnicalField(field)) {
      return true;
    }
    return false;
  }

  private isTimestampField(field: string): boolean {
    const patterns = [
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
    return patterns.some((p) => field.toLowerCase().includes(p.toLowerCase()));
  }
  private isTechnicalField(field: string): boolean {
    const patterns = [
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
    return patterns.some((p) => field.toLowerCase().includes(p.toLowerCase()));
  }
  private isPotentialPiiField(field: string): boolean {
    if (this.isTechnicalField(field) || this.isTimestampField(field)) {
      return false;
    }
    if (field.endsWith("Id") || field === "id" || field.endsWith("_id")) {
      return false;
    }
    return COMMON_PII_PATTERNS.some((p) => p.test(field));
  }

  private anonymizeField(
    field: string,
    value: unknown,
    entityName: string,
    deepScan: boolean = false
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      return this.processStringValue(field, value, entityName, deepScan);
    }
    if (typeof value === "number") {
      return value;
    }
    if (Array.isArray(value)) {
      return this.processArrayValue(field, value, entityName, deepScan);
    }
    if (typeof value === "object") {
      return this.anonymizeNestedObject(value as Record<string, unknown>, entityName, deepScan);
    }
    return value;
  }

  private processStringValue(
    field: string,
    value: string,
    entityName: string,
    deepScan: boolean
  ): string {
    if (deepScan || this.isLikelyPiiString(value)) {
      return this.anonymizeString(field, value, entityName);
    }
    return value;
  }

  private processArrayValue(
    field: string,
    value: unknown[],
    entityName: string,
    deepScan: boolean
  ): unknown[] {
    return value.map((item) => this.processArrayItem(field, item, entityName, deepScan));
  }

  private processArrayItem(
    field: string,
    item: unknown,
    entityName: string,
    deepScan: boolean
  ): unknown {
    if (item === null || item === undefined) {
      return item;
    }
    if (typeof item === "string") {
      return this.processStringValue(field, item, entityName, deepScan);
    }
    if (typeof item === "number") {
      return item;
    }
    if (typeof item === "object") {
      return this.anonymizeNestedObject(item as Record<string, unknown>, entityName, deepScan);
    }
    return item;
  }

  private anonymizeNestedObject(
    obj: Record<string, unknown>,
    entityName: string,
    deepScan: boolean = false
  ): Record<string, unknown> {
    const anonymizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined) {
        anonymizedObj[key] = val;
        continue;
      }
      const piiFields = PII_FIELDS[entityName];
      const shouldAnonymize =
        deepScan ||
        this.isPotentialPiiField(key) ||
        (piiFields !== undefined && piiFields.includes(key)) ||
        this.isNestedPiiKey(key);
      anonymizedObj[key] = this.processNestedValue(key, val, entityName, deepScan, shouldAnonymize);
    }
    return anonymizedObj;
  }

  private processNestedValue(
    key: string,
    val: unknown,
    entityName: string,
    deepScan: boolean,
    shouldAnonymize: boolean
  ): unknown {
    if (shouldAnonymize) {
      if (typeof val === "string") {
        return this.anonymizeString(key, val, entityName);
      }
      if (typeof val === "object") {
        return this.anonymizeField(key, val, entityName, true);
      }
      return val;
    }
    if (typeof val === "object") {
      return this.anonymizeField(key, val, entityName, deepScan);
    }
    return val;
  }

  private isNestedPiiKey(key: string): boolean {
    const piiKeywords = [
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
    const piiSuffixes = ["info", "data", "details", "metadata"];
    const lowerKey = key.toLowerCase();
    return (
      piiKeywords.some((kw) => lowerKey.includes(kw)) ||
      piiSuffixes.some((s) => lowerKey.endsWith(s))
    );
  }
  private isLikelyPiiString(value: string): boolean {
    if (value.length < 3 || value.length > 500) {
      return false;
    }
    if (this.looksLikeEmail(value)) {
      return true;
    }
    if (this.looksLikePhone(value)) {
      return true;
    }
    const namePattern = /^[A-Z][a-z]{1,20} [A-Z][a-z]{1,20}$/;
    return namePattern.test(value);
  }

  private looksLikeEmail(value: string): boolean {
    const atPositions = this.findAllAtPositions(value);
    return atPositions.some((atIdx) => this.isValidEmailAtPosition(value, atIdx));
  }

  private findAllAtPositions(value: string): number[] {
    const positions: number[] = [];
    let i = value.indexOf("@");
    while (i !== -1) {
      positions.push(i);
      i = value.indexOf("@", i + 1);
    }
    return positions;
  }

  private isValidEmailAtPosition(value: string, atIdx: number): boolean {
    const localStart = this.findLocalStart(value, atIdx);
    const domainEnd = this.findDomainEnd(value, atIdx);
    if (localStart >= atIdx || domainEnd <= atIdx + 1) {
      return false;
    }
    const local = value.slice(localStart, atIdx);
    const domain = value.slice(atIdx + 1, domainEnd);
    return local.length >= 1 && local.length <= 64 && domain.includes(".") && domain.length >= 3;
  }

  private findLocalStart(s: string, atIdx: number): number {
    let i = atIdx - 1;
    while (i >= 0 && /[a-zA-Z0-9._%+-]/.test(s[i] ?? '')) {
      i--;
    }
    return i + 1;
  }

  private findDomainEnd(s: string, atIdx: number): number {
    let i = atIdx + 1;
    while (i < s.length && /[a-zA-Z0-9.-]/.test(s[i] ?? '')) {
      i++;
    }
    return i;
  }
  private looksLikePhone(value: string): boolean {
    const digits = value.replaceAll(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  private anonymizeString(field: string, value: string, entityName: string): string {
    const cacheKey = `${entityName}:${field}:${value}`;
    if (this.pseudonymCache.has(cacheKey)) {
      return this.pseudonymCache.get(cacheKey)!;
    }

    const anonymized = this.selectAnonymizationStrategy(field, value);
    this.pseudonymCache.set(cacheKey, anonymized);
    return anonymized;
  }

  private selectAnonymizationStrategy(field: string, value: string): string {
    if (this.isEmailField(field)) {
      return this.generatePseudoEmail(value);
    }
    if (this.isPhoneField(field)) {
      return this.generatePseudoPhone(value);
    }
    if (this.isNameField(field)) {
      return this.generatePseudoName(value, field);
    }
    if (this.isAddressField(field)) {
      return this.generatePseudoAddress(value, field);
    }
    if (this.isIdentifierField(field)) {
      return this.generatePseudoIdentifier(value);
    }
    return this.generatePseudoText(value);
  }

  private isEmailField(field: string): boolean {
    return field.toLowerCase().includes("email");
  }
  private isPhoneField(field: string): boolean {
    return ["phone", "mobile", "tel", "fax", "contact"].some((p) =>
      field.toLowerCase().includes(p)
    );
  }
  private isNameField(field: string): boolean {
    return ["name", "first", "last", "author", "reviewer", "technician", "assignee"].some((p) =>
      field.toLowerCase().includes(p)
    );
  }
  private isAddressField(field: string): boolean {
    return ["address", "street", "city", "state", "country", "postal", "zip"].some((p) =>
      field.toLowerCase().includes(p)
    );
  }
  private isIdentifierField(field: string): boolean {
    return ["passport", "license", "certificate", "registration", "seaman", "ssn", "tax"].some(
      (p) => field.toLowerCase().includes(p)
    );
  }

  private generatePseudoEmail(original: string): string {
    const hash = this.hashValue(original);
    return `user_${hash.substring(0, 8)}@anonymized-${hash.substring(8, 12)}.example.com`;
  }
  private generatePseudoPhone(original: string): string {
    const hash = this.hashValue(original);
    const digits = hash.replaceAll(/\D/g, "").substring(0, 10).padEnd(10, "0");
    return `+1-XXX-${digits.substring(0, 3)}-${digits.substring(3, 7)}`;
  }
  private generatePseudoName(original: string, field: string): string {
    const hash = this.hashValue(original);
    const prefix = this.getNamePrefix(field.toLowerCase());
    return `${prefix}_${hash.substring(0, 6).toUpperCase()}`;
  }

  private getNamePrefix(lowerField: string): string {
    if (lowerField.includes("first")) {
      return "First";
    }
    if (lowerField.includes("last")) {
      return "Last";
    }
    return "Person";
  }
  private generatePseudoAddress(original: string, field: string): string {
    const hash = this.hashValue(original);
    const lowerField = field.toLowerCase();
    return this.getAddressFormat(lowerField, hash);
  }

  private getAddressFormat(lowerField: string, hash: string): string {
    const formatters: Array<{ test: (f: string) => boolean; format: (h: string) => string }> = [
      { test: (f) => f.includes("city"), format: (h) => `City_${h.substring(0, 4).toUpperCase()}` },
      { test: (f) => f.includes("state"), format: (h) => `ST${h.substring(0, 2).toUpperCase()}` },
      {
        test: (f) => f.includes("country"),
        format: (h) => `Country_${h.substring(0, 3).toUpperCase()}`,
      },
      {
        test: (f) => f.includes("postal") || f.includes("zip"),
        format: (h) => h.substring(0, 5).toUpperCase(),
      },
    ];
    const matched = formatters.find((fmt) => fmt.test(lowerField));
    return matched ? matched.format(hash) : `${hash.substring(0, 4).toUpperCase()} Anonymized St`;
  }
  private generatePseudoIdentifier(original: string): string {
    const hash = this.hashValue(original);
    return `ANON-${hash.substring(0, 12).toUpperCase()}`;
  }
  private generatePseudoText(original: string): string {
    const hash = this.hashValue(original);
    const wordCount = original.split(/\s+/).length;
    if (wordCount <= 1) {
      return `REDACTED_${hash.substring(0, 8)}`;
    }
    return `[Anonymized text - ${hash.substring(0, 8)}]`;
  }
  private hashValue(value: string): string {
    return crypto.createHash("sha256").update(`${this.salt}:${value}`).digest("hex");
  }

  generateAnonymizationReport(
    entityResults: Record<string, AnonymizationResult>,
    config: AnonymizationConfig
  ): AnonymizationReport {
    let totalOriginal = 0,
      totalAnonymized = 0,
      totalSkipped = 0;
    for (const result of Object.values(entityResults)) {
      totalOriginal += result.originalFieldCount;
      totalAnonymized += result.anonymizedFieldCount;
      totalSkipped += result.skippedFieldCount;
    }
    return {
      timestamp: new Date().toISOString(),
      config: {
        level: config.level,
        preserveIds: config.preserveIds,
        preserveTimestamps: config.preserveTimestamps,
        preserveTechnicalData: config.preserveTechnicalData,
      },
      summary: {
        totalFields: totalOriginal,
        anonymizedFields: totalAnonymized,
        skippedFields: totalSkipped,
        anonymizationRate:
          totalOriginal > 0 ? `${((totalAnonymized / totalOriginal) * 100).toFixed(2)}%` : "0%",
      },
      entityBreakdown: entityResults,
      saltHash: crypto.createHash("sha256").update(this.salt).digest("hex").substring(0, 16),
    };
  }
}
