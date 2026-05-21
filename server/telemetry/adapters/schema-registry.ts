import { eq, sql, and, desc } from "drizzle-orm";
import { db } from "../../db-config";
import { telemetrySchemaRegistry, type TelemetrySchemaRegistry } from "@shared/schema/telemetry";
import { logger } from "../../utils/logger";

export interface SchemaDefinition {
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ValidationRule {
  field: string;
  rule: "required" | "range" | "regex" | "enum";
  params?: Record<string, unknown>;
}

export interface DecoderConfig {
  decoderType: string;
  params?: Record<string, unknown>;
}

export interface RegisterSchemaInput {
  protocol: string;
  version: number;
  schemaName: string;
  description?: string;
  schemaDefinition: SchemaDefinition;
  validationRules?: ValidationRule[];
  decoderConfig?: DecoderConfig;
  createdBy?: string;
}

export class TelemetrySchemaRegistryAdapter {
  async registerSchema(input: RegisterSchemaInput): Promise<TelemetrySchemaRegistry> {
    const existing = await this.getSchema(input.protocol, input.version);
    if (existing) {
      throw new Error(`Schema already exists: ${input.protocol} v${input.version}`);
    }

    const [inserted] = await db
      .insert(telemetrySchemaRegistry)
      .values({
        protocol: input.protocol,
        version: input.version,
        schemaName: input.schemaName,
        description: input.description,
        schemaDefinition: input.schemaDefinition as object as never,
        validationRules: input.validationRules as object as never,
        decoderConfig: input.decoderConfig as object as never,
        createdBy: input.createdBy,
      })
      .returning();

    logger.info("SchemaRegistry", "Schema registered", {
      protocol: input.protocol,
      version: input.version,
      schemaName: input.schemaName,
    });

    return inserted;
  }

  async getSchema(protocol: string, version: number): Promise<TelemetrySchemaRegistry | undefined> {
    const [row] = await db
      .select()
      .from(telemetrySchemaRegistry)
      .where(
        and(
          eq(telemetrySchemaRegistry.protocol, protocol),
          eq(telemetrySchemaRegistry.version, version)
        )
      );
    return row;
  }

  async getActiveSchema(protocol: string): Promise<TelemetrySchemaRegistry | undefined> {
    const [row] = await db
      .select()
      .from(telemetrySchemaRegistry)
      .where(
        and(
          eq(telemetrySchemaRegistry.protocol, protocol),
          eq(telemetrySchemaRegistry.isActive, true)
        )
      )
      .orderBy(desc(telemetrySchemaRegistry.version))
      .limit(1);
    return row;
  }

  async getLatestVersion(protocol: string): Promise<number> {
    const [row] = await db
      .select({ maxVersion: sql<number>`max(${telemetrySchemaRegistry.version})` })
      .from(telemetrySchemaRegistry)
      .where(eq(telemetrySchemaRegistry.protocol, protocol));
    return row?.maxVersion ?? 0;
  }

  async listSchemas(protocol?: string): Promise<TelemetrySchemaRegistry[]> {
    if (protocol) {
      return db
        .select()
        .from(telemetrySchemaRegistry)
        .where(eq(telemetrySchemaRegistry.protocol, protocol))
        .orderBy(desc(telemetrySchemaRegistry.version));
    }
    return db
      .select()
      .from(telemetrySchemaRegistry)
      .orderBy(telemetrySchemaRegistry.protocol, desc(telemetrySchemaRegistry.version));
  }

  async deprecateSchema(protocol: string, version: number): Promise<void> {
    await db
      .update(telemetrySchemaRegistry)
      .set({
        isActive: false,
        deprecatedAt: new Date(),
      })
      .where(
        and(
          eq(telemetrySchemaRegistry.protocol, protocol),
          eq(telemetrySchemaRegistry.version, version)
        )
      );

    logger.info("SchemaRegistry", "Schema deprecated", { protocol, version });
  }

  async activateSchema(protocol: string, version: number): Promise<void> {
    await db
      .update(telemetrySchemaRegistry)
      .set({ isActive: false })
      .where(eq(telemetrySchemaRegistry.protocol, protocol));

    await db
      .update(telemetrySchemaRegistry)
      .set({
        isActive: true,
        deprecatedAt: null,
      })
      .where(
        and(
          eq(telemetrySchemaRegistry.protocol, protocol),
          eq(telemetrySchemaRegistry.version, version)
        )
      );

    logger.info("SchemaRegistry", "Schema activated", { protocol, version });
  }

  async validatePayload(
    protocol: string,
    version: number,
    payload: Record<string, unknown>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const schema = await this.getSchema(protocol, version);
    if (!schema) {
      return { valid: false, errors: [`Schema not found: ${protocol} v${version}`] };
    }

    const errors: string[] = [];
    const definition = schema.schemaDefinition as SchemaDefinition;
    const rules = (schema.validationRules as ValidationRule[]) ?? [];

    for (const field of definition.fields) {
      if (field.required && !(field.name in payload)) {
        errors.push(`Missing required field: ${field.name}`);
      }
    }

    for (const rule of rules) {
      const value = payload[rule.field];

      switch (rule.rule) {
        case "required":
          if (value === undefined || value === null) {
            errors.push(`Field ${rule.field} is required`);
          }
          break;
        case "range":
          if (typeof value === "number") {
            const min = (rule.params?.min as number) ?? -Infinity;
            const max = (rule.params?.max as number) ?? Infinity;
            if (value < min || value > max) {
              errors.push(`Field ${rule.field} must be between ${min} and ${max}`);
            }
          }
          break;
        case "regex":
          if (typeof value === "string" && rule.params?.pattern) {
            const regex = new RegExp(rule.params.pattern as string);
            if (!regex.test(value)) {
              errors.push(`Field ${rule.field} does not match pattern`);
            }
          }
          break;
        case "enum":
          if (rule.params?.values && !(rule.params.values as unknown[]).includes(value)) {
            errors.push(
              `Field ${rule.field} must be one of: ${(rule.params.values as unknown[]).join(", ")}`
            );
          }
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getDecoderConfig(protocol: string, version?: number): Promise<DecoderConfig | undefined> {
    const schema = version
      ? await this.getSchema(protocol, version)
      : await this.getActiveSchema(protocol);

    return schema?.decoderConfig as DecoderConfig | undefined;
  }

  async seedDefaultSchemas(): Promise<void> {
    const j1939Exists = await this.getSchema("J1939", 1);
    if (!j1939Exists) {
      await this.registerSchema({
        protocol: "J1939",
        version: 1,
        schemaName: "J1939 CAN Bus Protocol",
        description: "SAE J1939 CAN bus protocol for heavy-duty vehicles and marine engines",
        schemaDefinition: {
          fields: [
            { name: "pgn", type: "integer", required: true, description: "Parameter Group Number" },
            {
              name: "sourceAddress",
              type: "integer",
              required: true,
              description: "Source address (0-253)",
            },
            { name: "priority", type: "integer", description: "Message priority (0-7)" },
            {
              name: "data",
              type: "bytes",
              required: true,
              description: "CAN data payload (up to 8 bytes)",
            },
          ],
        },
        validationRules: [
          { field: "pgn", rule: "range", params: { min: 0, max: 262143 } },
          { field: "sourceAddress", rule: "range", params: { min: 0, max: 253 } },
        ],
        decoderConfig: {
          decoderType: "j1939",
          params: { endianness: "little" },
        },
        createdBy: "system",
      });
    }

    const j1587Exists = await this.getSchema("J1587", 1);
    if (!j1587Exists) {
      await this.registerSchema({
        protocol: "J1587",
        version: 1,
        schemaName: "J1587 Serial Protocol",
        description: "SAE J1587/J1708 serial protocol for older heavy-duty vehicles",
        schemaDefinition: {
          fields: [
            { name: "mid", type: "integer", required: true, description: "Message ID" },
            { name: "pid", type: "integer", required: true, description: "Parameter ID" },
            { name: "data", type: "bytes", required: true, description: "Data payload" },
          ],
        },
        validationRules: [
          { field: "mid", rule: "range", params: { min: 0, max: 255 } },
          { field: "pid", rule: "range", params: { min: 0, max: 511 } },
        ],
        decoderConfig: {
          decoderType: "j1587",
        },
        createdBy: "system",
      });
    }

    logger.info("SchemaRegistry", "Default schemas seeded");
  }
}

export const schemaRegistryAdapter = new TelemetrySchemaRegistryAdapter();
