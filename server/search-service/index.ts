/**
 * Search Service - Main Entry Point
 * Re-exports service and utilities
 */

export { SearchService, searchService } from "./service.js";
export { searchVessels, searchEquipment, searchAlerts, searchWorkOrders, searchCrew, searchSensors } from "./entity-searches.js";
