import { eq, and, sql, ilike, desc, asc, SQL, getTableColumns } from "drizzle-orm";
import { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../db.js";

/**
 * Hides the unavoidable Drizzle insert generic widening behind one cast.
 * Drizzle's .values() accepts a structurally compatible shape but its
 * generic type is invariant, so a narrowly-typed InsertT often won't
 * unify without help. Centralising the cast here keeps all repository
 * call sites cast-free.
 */
function insertValues<U>(v: U): Record<string, unknown> | Record<string, unknown>[] {
  return v as Record<string, unknown> | Record<string, unknown>[];
}
function setValues<U>(v: U): Record<string, unknown> {
  return v as Record<string, unknown>;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FilterOptions {
  [key: string]: string | number | boolean | Date | undefined | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ColumnConfig {
  orgIdColumn?: string;
  idColumn?: string;
  updatedAtColumn?: string | null;
}

export class BaseRepository<T extends Record<string, unknown>, InsertT> {
  protected orgIdColumn: string;
  protected idColumn: string;
  protected updatedAtColumn: string | null;

  constructor(
    protected table: PgTable,
    config: ColumnConfig = {}
  ) {
    this.orgIdColumn = config.orgIdColumn ?? "orgId";
    this.idColumn = config.idColumn ?? "id";
    this.updatedAtColumn = config.updatedAtColumn ?? "updatedAt";

    this.validateColumns();
  }

  /**
   * Single chokepoint for dynamic column access on a generic table.
   * Drizzle's PgTableWithColumns<any> doesn't expose a typed column index,
   * so this helper isolates the necessary unsafe access into one place
   * instead of scattering `this.columns()[col]` throughout.
   */
  protected col(name: string): PgColumn | undefined {
    return this.columns()[name];
  }

  /**
   * Returns a required column or throws. Used for orgId/id and other
   * statically-known columns so the noUncheckedIndexedAccess lookup
   * never leaks an undefined into Drizzle helpers (eq/ilike/and).
   */
  protected requireCol(name: string): PgColumn {
    const c = this.columns()[name];
    if (!c) {
      throw new Error(`BaseRepository: required column '${name}' missing on table`);
    }
    return c;
  }

  private columns(): Record<string, PgColumn> {
    return getTableColumns(this.table) as Record<string, PgColumn>;
  }

  private validateColumns(): void {
    const tableColumns = this.columns();
    if (!tableColumns[this.orgIdColumn]) {
      throw new Error(
        `BaseRepository: table missing required column '${this.orgIdColumn}' (orgId). ` +
          `Available columns: ${Object.keys(tableColumns)
            .filter((k) => !k.startsWith("_"))
            .join(", ")}`
      );
    }
    if (!tableColumns[this.idColumn]) {
      throw new Error(
        `BaseRepository: table missing required column '${this.idColumn}' (id). ` +
          `Available columns: ${Object.keys(tableColumns)
            .filter((k) => !k.startsWith("_"))
            .join(", ")}`
      );
    }
  }

  async list(orgId: string, filters?: FilterOptions): Promise<T[]> {
    const conditions: SQL[] = [eq(this.requireCol(this.orgIdColumn), orgId)];

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) {continue;}
        const column = this.columns()[key];
        if (!column) {continue;}
        if (typeof value === "string" && key.toLowerCase().includes("search")) {
          conditions.push(ilike(column, `%${value}%`));
        } else {
          conditions.push(eq(column, value));
        }
      }
    }

    const result = await db
      .select()
      .from(this.table)
      .where(and(...conditions));

    return result as T[];
  }

  async listPaginated(
    orgId: string,
    pagination: PaginationOptions,
    filters?: FilterOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<T>> {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? pagination.limit ?? 20;
    const offset = pagination.offset ?? (page - 1) * pageSize;

    const conditions: SQL[] = [eq(this.requireCol(this.orgIdColumn), orgId)];

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) {continue;}
        const column = this.columns()[key];
        if (!column) {continue;}
        if (typeof value === "string" && key.toLowerCase().includes("search")) {
          conditions.push(ilike(column, `%${value}%`));
        } else {
          conditions.push(eq(column, value));
        }
      }
    }

    const whereClause = and(...conditions);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    let query = db.select().from(this.table).where(whereClause).limit(pageSize).offset(offset);

    if (sort?.sortBy) {
      const sortColumn = this.columns()[sort.sortBy];
      if (sortColumn) {
        query = query.orderBy(
          sort.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn)
        ) as typeof query;
      }
    }

    const items = await query;

    return {
      items: items as T[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(id: string, orgId: string): Promise<T | null> {
    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.requireCol(this.idColumn), id),
          eq(this.requireCol(this.orgIdColumn), orgId)
        )
      )
      .limit(1);

    return (result[0] as T) ?? null;
  }

  async create(data: InsertT): Promise<T> {
    const result = await db
      .insert(this.table)
      .values(insertValues(data))
      .returning();

    return result[0] as T;
  }

  async update(id: string, data: Partial<InsertT>, orgId: string): Promise<T> {
    const updateData: Record<string, unknown> = { ...data };

    if (this.updatedAtColumn && this.columns()[this.updatedAtColumn]) {
      updateData[this.updatedAtColumn] = new Date();
    }

    const result = await db
      .update(this.table)
      .set(setValues(updateData))
      .where(
        and(
          eq(this.requireCol(this.idColumn), id),
          eq(this.requireCol(this.orgIdColumn), orgId)
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error(`Record not found: ${this.idColumn}=${id}`);
    }

    return result[0] as T;
  }

  async delete(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(this.table)
      .where(
        and(
          eq(this.requireCol(this.idColumn), id),
          eq(this.requireCol(this.orgIdColumn), orgId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async exists(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`1` })
      .from(this.table)
      .where(
        and(
          eq(this.requireCol(this.idColumn), id),
          eq(this.requireCol(this.orgIdColumn), orgId)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async count(orgId: string, filters?: FilterOptions): Promise<number> {
    const conditions: SQL[] = [eq(this.requireCol(this.orgIdColumn), orgId)];

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) {continue;}
        const column = this.columns()[key];
        if (!column) {continue;}
        conditions.push(eq(column, value));
      }
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async bulkCreate(items: InsertT[]): Promise<T[]> {
    if (items.length === 0) {
      return [];
    }

    const result = await db
      .insert(this.table)
      .values(insertValues(items))
      .returning();

    return result as T[];
  }

  async bulkDelete(ids: string[], orgId: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    let deleted = 0;
    for (const id of ids) {
      const success = await this.delete(id, orgId);
      if (success) {
        deleted++;
      }
    }

    return deleted;
  }
}

export function createBaseService<T extends Record<string, unknown>, InsertT>(
  repository: BaseRepository<T, InsertT>,
  orgIdColumn: string = "orgId"
) {
  return {
    async list(orgId: string, filters?: FilterOptions): Promise<T[]> {
      return repository.list(orgId, filters);
    },

    async listPaginated(
      orgId: string,
      pagination: PaginationOptions,
      filters?: FilterOptions
    ): Promise<{ items: T[]; total: number }> {
      const result = await repository.listPaginated(orgId, pagination, filters);
      return { items: result.items, total: result.total };
    },

    async getById(id: string, orgId: string): Promise<T | null> {
      return repository.getById(id, orgId);
    },

    async create(data: InsertT, orgId: string, _userId?: string): Promise<T> {
      const dataWithOrg = { ...data, [orgIdColumn]: orgId } as InsertT;
      return repository.create(dataWithOrg);
    },

    async update(id: string, data: Partial<InsertT>, orgId: string, _userId?: string): Promise<T> {
      return repository.update(id, data, orgId);
    },

    async delete(id: string, orgId: string, _userId?: string): Promise<void> {
      await repository.delete(id, orgId);
    },
  };
}
