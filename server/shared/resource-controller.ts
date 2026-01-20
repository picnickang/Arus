import { Request, Response, Express } from "express";
import { z, ZodObject, ZodRawShape, ZodType, ZodTypeDef } from "zod";
import { withErrorHandling } from "../lib/route-utils.js";
import {
  generalApiRateLimit,
  writeOperationRateLimit,
  criticalOperationRateLimit,
} from "../config/rate-limits.js";
import { requireOrgId, AuthenticatedRequest } from "../middleware/auth.js";

type AnyZodObject = ZodObject<any, any, any>;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export interface FilterParams {
  [key: string]: string | number | boolean | Date | undefined;
}

export interface ResourceService<T, InsertT> {
  list(orgId: string, filters?: FilterParams): Promise<T[]>;
  listPaginated?(
    orgId: string,
    pagination: PaginationParams,
    filters?: FilterParams
  ): Promise<{ items: T[]; total: number }>;
  getById(id: string, orgId: string): Promise<T | null>;
  create(data: InsertT, orgId: string, userId?: string): Promise<T>;
  update(id: string, data: Partial<InsertT>, orgId: string, userId?: string): Promise<T>;
  delete(id: string, orgId: string, userId?: string): Promise<void>;
}

export interface ResourceControllerConfig<T, InsertT> {
  basePath: string;
  resourceName: string;
  insertSchema: AnyZodObject;
  service: ResourceService<T, InsertT>;
  filterKeys?: string[];
  supportsPagination?: boolean;
  idParam?: string;
  beforeCreate?: (req: Request, data: InsertT) => InsertT | Promise<InsertT>;
  beforeUpdate?: (req: Request, data: Partial<InsertT>) => Partial<InsertT> | Promise<Partial<InsertT>>;
  afterCreate?: (req: Request, res: Response, item: T) => void | Promise<void>;
  afterUpdate?: (req: Request, res: Response, item: T) => void | Promise<void>;
  afterDelete?: (req: Request, res: Response) => void | Promise<void>;
}

export function createResourceController<T, InsertT>(
  app: Express,
  config: ResourceControllerConfig<T, InsertT>
): void {
  const {
    basePath,
    resourceName,
    insertSchema,
    service,
    filterKeys = [],
    supportsPagination = true,
    idParam = "id",
    beforeCreate,
    beforeUpdate,
    afterCreate,
    afterUpdate,
    afterDelete,
  } = config;

  app.get(
    basePath,
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling(`fetch ${resourceName} list`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const filters: FilterParams = {};
      for (const key of filterKeys) {
        if (req.query[key] !== undefined) {
          filters[key] = req.query[key] as string;
        }
      }

      if (supportsPagination && service.listPaginated) {
        const pageParam = req.query.page;
        const pageSizeParam = req.query.pageSize;
        const limitParam = req.query.limit;
        const offsetParam = req.query.offset;

        const usePagination =
          pageParam !== undefined ||
          pageSizeParam !== undefined ||
          limitParam !== undefined ||
          offsetParam !== undefined;

        if (usePagination) {
          let page = 1;
          let pageSize = 20;

          if (limitParam !== undefined && offsetParam !== undefined) {
            const limit = Number.parseInt(limitParam as string, 10);
            const offset = Number.parseInt(offsetParam as string, 10);
            if (Number.isNaN(limit) || limit < 1 || limit > 100) {
              res.status(400).json({ message: "Limit must be between 1 and 100" });
              return;
            }
            if (Number.isNaN(offset) || offset < 0) {
              res.status(400).json({ message: "Offset must be non-negative" });
              return;
            }
            pageSize = limit;
            page = Math.floor(offset / limit) + 1;
          } else {
            page = pageParam ? Number.parseInt(pageParam as string, 10) : 1;
            pageSize = pageSizeParam ? Number.parseInt(pageSizeParam as string, 10) : 20;
          }

          if (Number.isNaN(page) || page < 1) {
            res.status(400).json({ message: "Invalid page number" });
            return;
          }
          if (Number.isNaN(pageSize) || pageSize < 1 || pageSize > 1000) {
            res.status(400).json({ message: "Invalid page size (must be 1-1000)" });
            return;
          }

          const result = await service.listPaginated(orgId, { page, pageSize }, filters);
          res.json({
            data: result.items,
            total: result.total,
            page,
            pageSize,
          });
          return;
        }
      }

      const items = await service.list(orgId, filters);
      res.json(items);
    })
  );

  app.get(
    `${basePath}/:${idParam}`,
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling(`fetch ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const id = req.params[idParam];

      const item = await service.getById(id, orgId);
      if (!item) {
        res.status(404).json({ message: `${resourceName} not found` });
        return;
      }

      res.json(item);
    })
  );

  app.post(
    basePath,
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling(`create ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;

      let data = insertSchema.parse(req.body) as InsertT;
      if (beforeCreate) {
        data = await beforeCreate(req, data);
      }

      const item = await service.create(data, orgId, userId);

      if (afterCreate) {
        await afterCreate(req, res, item);
      }

      res.status(201).json(item);
    })
  );

  app.put(
    `${basePath}/:${idParam}`,
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling(`update ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const id = req.params[idParam];

      const existing = await service.getById(id, orgId);
      if (!existing) {
        res.status(404).json({ message: `${resourceName} not found` });
        return;
      }

      const partialSchema = insertSchema.partial();
      let data = partialSchema.parse(req.body) as Partial<InsertT>;
      if (beforeUpdate) {
        data = await beforeUpdate(req, data);
      }

      const item = await service.update(id, data, orgId, userId);

      if (afterUpdate) {
        await afterUpdate(req, res, item);
      }

      res.json(item);
    })
  );

  app.patch(
    `${basePath}/:${idParam}`,
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling(`patch ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const id = req.params[idParam];

      const existing = await service.getById(id, orgId);
      if (!existing) {
        res.status(404).json({ message: `${resourceName} not found` });
        return;
      }

      const partialSchema = insertSchema.partial();
      let data = partialSchema.parse(req.body) as Partial<InsertT>;
      if (beforeUpdate) {
        data = await beforeUpdate(req, data);
      }

      const item = await service.update(id, data, orgId, userId);

      if (afterUpdate) {
        await afterUpdate(req, res, item);
      }

      res.json(item);
    })
  );

  app.delete(
    `${basePath}/:${idParam}`,
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling(`delete ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const id = req.params[idParam];

      const existing = await service.getById(id, orgId);
      if (!existing) {
        res.status(404).json({ message: `${resourceName} not found` });
        return;
      }

      await service.delete(id, orgId, userId);

      if (afterDelete) {
        await afterDelete(req, res);
      }

      res.status(204).send();
    })
  );
}

export function createNestedResourceController<T, InsertT, ParentT>(
  app: Express,
  config: ResourceControllerConfig<T, InsertT> & {
    parentPath: string;
    parentIdParam: string;
    getParent: (parentId: string, orgId: string) => Promise<ParentT | null>;
    parentResourceName: string;
  }
): void {
  const {
    basePath,
    resourceName,
    insertSchema,
    service,
    filterKeys = [],
    idParam = "id",
    parentPath,
    parentIdParam,
    getParent,
    parentResourceName,
    beforeCreate,
    beforeUpdate,
    afterCreate,
    afterUpdate,
    afterDelete,
  } = config;

  const fullBasePath = `${parentPath}/:${parentIdParam}${basePath}`;

  app.get(
    fullBasePath,
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling(`fetch ${resourceName} list`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parentId = req.params[parentIdParam];

      const parent = await getParent(parentId, orgId);
      if (!parent) {
        res.status(404).json({ message: `${parentResourceName} not found` });
        return;
      }

      const filters: FilterParams = { [parentIdParam]: parentId };
      for (const key of filterKeys) {
        if (req.query[key] !== undefined) {
          filters[key] = req.query[key] as string;
        }
      }

      const items = await service.list(orgId, filters);
      res.json(items);
    })
  );

  app.post(
    fullBasePath,
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling(`create ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const parentId = req.params[parentIdParam];

      const parent = await getParent(parentId, orgId);
      if (!parent) {
        res.status(404).json({ message: `${parentResourceName} not found` });
        return;
      }

      let data = insertSchema.parse(req.body) as InsertT;
      (data as Record<string, unknown>)[parentIdParam] = parentId;

      if (beforeCreate) {
        data = await beforeCreate(req, data);
      }

      const item = await service.create(data, orgId, userId);

      if (afterCreate) {
        await afterCreate(req, res, item);
      }

      res.status(201).json(item);
    })
  );

  app.patch(
    `${fullBasePath}/:${idParam}`,
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling(`update ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const id = req.params[idParam];
      const parentId = req.params[parentIdParam];

      const parent = await getParent(parentId, orgId);
      if (!parent) {
        res.status(404).json({ message: `${parentResourceName} not found` });
        return;
      }

      const existing = await service.getById(id, orgId);
      if (!existing) {
        res.status(404).json({ message: `${resourceName} not found` });
        return;
      }

      const partialSchema = insertSchema.partial();
      let data = partialSchema.parse(req.body) as Partial<InsertT>;
      if (beforeUpdate) {
        data = await beforeUpdate(req, data);
      }

      const item = await service.update(id, data, orgId, userId);

      if (afterUpdate) {
        await afterUpdate(req, res, item);
      }

      res.json(item);
    })
  );

  app.delete(
    `${fullBasePath}/:${idParam}`,
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling(`delete ${resourceName}`, async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const id = req.params[idParam];
      const parentId = req.params[parentIdParam];

      const parent = await getParent(parentId, orgId);
      if (!parent) {
        res.status(404).json({ message: `${parentResourceName} not found` });
        return;
      }

      const existing = await service.getById(id, orgId);
      if (!existing) {
        res.status(404).json({ message: `${resourceName} not found` });
        return;
      }

      await service.delete(id, orgId, userId);

      if (afterDelete) {
        await afterDelete(req, res);
      }

      res.status(204).send();
    })
  );
}
