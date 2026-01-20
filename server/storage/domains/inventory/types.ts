/**
 * Inventory/Parts Storage Types
 * Parts, inventory, suppliers, and stock management
 */

import type {
  Part,
  InsertPart,
  PartsInventory,
  InsertPartsInventory,
  Supplier,
  InsertSupplier,
  Stock,
  InsertStock,
  PartSubstitution,
  InsertPartSubstitution,
} from "@shared/schema-runtime";

export interface PartFilters {
  orgId?: string;
  category?: string;
  status?: string;
}

export interface StockFilters {
  vesselId?: string;
  partId?: string;
  lowStock?: boolean;
}

/**
 * Inventory Storage Interface
 */
export interface IInventoryStorage {
  // Parts CRUD
  getParts(orgId?: string, filters?: PartFilters): Promise<Part[]>;
  getPart(id: string, orgId?: string): Promise<Part | undefined>;
  createPart(part: InsertPart): Promise<Part>;
  updatePart(id: string, part: Partial<InsertPart>): Promise<Part>;
  deletePart(id: string): Promise<void>;

  // Parts inventory (deprecated, use stock)
  getPartsInventory(): Promise<PartsInventory[]>;
  getPartsInventoryItem(id: string): Promise<PartsInventory | undefined>;
  createPartsInventoryItem(item: InsertPartsInventory): Promise<PartsInventory>;
  updatePartsInventoryItem(id: string, item: Partial<InsertPartsInventory>): Promise<PartsInventory>;
  deletePartsInventoryItem(id: string): Promise<void>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;

  // Stock
  getStock(vesselId?: string): Promise<Stock[]>;
  getStockItem(id: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(id: string, stock: Partial<InsertStock>): Promise<Stock>;
  deleteStock(id: string): Promise<void>;

  // Part substitutions
  getPartSubstitutions(partId?: string): Promise<PartSubstitution[]>;
  getPartSubstitution(id: string): Promise<PartSubstitution | undefined>;
  createPartSubstitution(substitution: InsertPartSubstitution): Promise<PartSubstitution>;
  updatePartSubstitution(id: string, substitution: Partial<InsertPartSubstitution>): Promise<PartSubstitution>;
  deletePartSubstitution(id: string): Promise<void>;
}

export type {
  Part,
  InsertPart,
  PartsInventory,
  InsertPartsInventory,
  Supplier,
  InsertSupplier,
  Stock,
  InsertStock,
  PartSubstitution,
  InsertPartSubstitution,
};
