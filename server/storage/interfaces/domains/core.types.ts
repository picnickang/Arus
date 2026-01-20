/**
 * Core Storage Interface - Organizations, Users, Settings
 * Part of IStorage modularization for improved maintainability
 */

import type {
  Organization,
  InsertOrganization,
  User,
  InsertUser,
  SystemSettings,
  InsertSettings,
} from "@shared/schema";

/**
 * Core storage operations for organizations, users, and system settings
 */
export interface ICoreStorage {
  // Organizations
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;

  // Users
  getUsers(orgId?: string): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string, orgId?: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // System Settings
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<SystemSettings>;

  // Idempotency
  checkIdempotency(key: string, endpoint: string): Promise<boolean>;
  recordIdempotency(key: string, endpoint: string): Promise<void>;
}
