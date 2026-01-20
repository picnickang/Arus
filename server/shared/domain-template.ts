import type { RequestHandler, Request, Response } from "express";
import { z } from "zod";
import { handleRouteError, AuthorizationError, mapStorageError } from "./error-handler";
import type { IStorage } from "../storage/interfaces/aggregate";

export interface DomainConfig<S = IStorage> {
  storage: S;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
  crewOperationRateLimit?: RequestHandler;
  reportGenerationRateLimit?: RequestHandler;
}

export type LegacyDomainConfig = DomainConfig<any>;

export function createDomainHandler<S = IStorage>(
  handler: (req: Request & { orgId?: string }, res: Response, config: DomainConfig<S>) => Promise<void>,
  config: DomainConfig<S>,
  context: string
) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req as Request & { orgId?: string }, res, config);
    } catch (error) {
      handleRouteError(error, res, context);
    }
  };
}

export function createStorageHandler<S = IStorage>(
  handler: (req: Request & { orgId?: string }, res: Response, config: DomainConfig<S>) => Promise<void>,
  config: DomainConfig<S>,
  context: string
) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req as Request & { orgId?: string }, res, config);
    } catch (error) {
      const domainError = mapStorageError(error, context);
      handleRouteError(domainError, res, context);
    }
  };
}

export function createTypedDomainHandler(
  handler: (req: Request & { orgId?: string }, res: Response, config: DomainConfig<IStorage>) => Promise<void>,
  config: DomainConfig<IStorage>,
  context: string
) {
  return createDomainHandler<IStorage>(handler, config, context);
}

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function validateParams<T>(schema: z.ZodSchema<T>, params: unknown): T {
  return schema.parse(params);
}

export function validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): T {
  return schema.parse(query);
}

export function getOrgId(req: Request & { orgId?: string }): string {
  const orgId = req.orgId;
  if (!orgId) {
    throw new AuthorizationError("Organization ID not found in request");
  }
  return orgId;
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  res.status(statusCode).json(data);
}

export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  limit: number,
  offset: number
): void {
  res.json({
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    },
  });
}
