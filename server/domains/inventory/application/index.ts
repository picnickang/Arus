/**
 * Inventory Application Layer
 * Composition root for dependency injection
 */

import { InventoryApplicationService } from './inventory-service.js';
import { partsInventoryRepository } from '../infrastructure/parts-inventory-repository-adapter.js';
import { inventoryEventPublisher } from '../infrastructure/event-publisher-adapter.js';

export const inventoryAppService = new InventoryApplicationService({
  partsInventoryRepository,
  eventPublisher: inventoryEventPublisher,
});

export { InventoryApplicationService } from './inventory-service.js';
