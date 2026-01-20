/**
 * Users - Database Storage
 */

import { eq, and } from "drizzle-orm";
import { db } from "../../db-config";
import { organizations, users, type Organization, type InsertOrganization, type User, type InsertUser } from "@shared/schema-runtime";

export class DatabaseUserStorage {
  async getOrganizations(): Promise<Organization[]> { return db.select().from(organizations).orderBy(organizations.name); }
  async getOrganization(id: string): Promise<Organization | undefined> { const [result] = await db.select().from(organizations).where(eq(organizations.id, id)); return result; }
  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> { const [result] = await db.select().from(organizations).where(eq(organizations.slug, slug)); return result; }
  async createOrganization(org: InsertOrganization): Promise<Organization> { const [result] = await db.insert(organizations).values({ ...org, createdAt: new Date(), updatedAt: new Date() }).returning(); return result; }
  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization> { const [result] = await db.update(organizations).set({ ...org, updatedAt: new Date() }).where(eq(organizations.id, id)).returning(); if (!result) {throw new Error(`Organization ${id} not found`);} return result; }
  async deleteOrganization(id: string): Promise<void> { const result = await db.delete(organizations).where(eq(organizations.id, id)).returning(); if (result.length === 0) {throw new Error(`Organization ${id} not found`);} }

  async getUsers(orgId?: string): Promise<User[]> { if (orgId) { return db.select().from(users).where(eq(users.orgId, orgId)).orderBy(users.name); } return db.select().from(users).orderBy(users.name); }
  async getUser(id: string, orgId?: string): Promise<User | undefined> { const conditions = [eq(users.id, id)]; if (orgId) { conditions.push(eq(users.orgId, orgId)); } const [result] = await db.select().from(users).where(and(...conditions)); return result; }
  async getUserByEmail(email: string, orgId?: string): Promise<User | undefined> { const conditions = [eq(users.email, email)]; if (orgId) { conditions.push(eq(users.orgId, orgId)); } const [result] = await db.select().from(users).where(and(...conditions)); return result; }
  async createUser(user: InsertUser): Promise<User> { const [result] = await db.insert(users).values({ ...user, createdAt: new Date(), updatedAt: new Date() }).returning(); return result; }
  async updateUser(id: string, user: Partial<InsertUser>, orgId?: string): Promise<User> { const conditions = [eq(users.id, id)]; if (orgId) { conditions.push(eq(users.orgId, orgId)); } const [result] = await db.update(users).set({ ...user, updatedAt: new Date() }).where(and(...conditions)).returning(); if (!result) { throw new Error(`User ${id} not found`); } return result; }
  async deleteUser(id: string, orgId?: string): Promise<void> { const conditions = [eq(users.id, id)]; if (orgId) { conditions.push(eq(users.orgId, orgId)); } const result = await db.delete(users).where(and(...conditions)).returning(); if (result.length === 0) { throw new Error(`User ${id} not found`); } }
}
