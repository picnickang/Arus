/**
 * Data-access seam for the model-promotion route handlers.
 *
 * Keeps the route module from importing the ML storage repository directly
 * (route-level db*Storage coupling tracked by the domain-leak guard). Route
 * handlers go through this seam instead of touching the storage symbol.
 */
import { dbMlAnalyticsStorage } from "../repositories.js";

export const mlModelStore = dbMlAnalyticsStorage;
