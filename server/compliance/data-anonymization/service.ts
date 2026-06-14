/**
 * Data Anonymization Service - Main Service Class
 * GDPR/PDPA-compliant data anonymization with deterministic pseudonymization
 */

import * as crypto from "node:crypto";
import type { AnonymizationConfig, AnonymizationResult, AnonymizationReport } from "./types.js";
import {
  isAddressField,
  isEmailField,
  isIdentifierField,
  isLikelyPiiString,
  isNameField,
  isNestedPiiKey,
  isPhoneField,
  isPotentialPiiField,
  isSensitiveFieldName,
  isTechnicalField,
  isTimestampField,
} from "./field-classification.js";
import { PII_FIELDS, PARTIAL_ANONYMIZE_FIELDS } from "./pii-fields.js";

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
      if (isPotentialPiiField(field)) {
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
    if (isSensitiveFieldName(field)) {
      return false;
    }
    if (config.preserveTimestamps && isTimestampField(field)) {
      return true;
    }
    if (config.preserveTechnicalData && isTechnicalField(field)) {
      return true;
    }
    return false;
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
    if (deepScan || isSensitiveFieldName(field) || isLikelyPiiString(value)) {
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
        isPotentialPiiField(key) ||
        (piiFields !== undefined && piiFields.includes(key)) ||
        isNestedPiiKey(key);
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
    if (isEmailField(field)) {
      return this.generatePseudoEmail(value);
    }
    if (isPhoneField(field)) {
      return this.generatePseudoPhone(value);
    }
    if (isNameField(field)) {
      return this.generatePseudoName(value, field);
    }
    if (isAddressField(field)) {
      return this.generatePseudoAddress(value, field);
    }
    if (isIdentifierField(field)) {
      return this.generatePseudoIdentifier(value);
    }
    return this.generatePseudoText(value);
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
