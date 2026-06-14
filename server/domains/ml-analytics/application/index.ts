/**
 * ML Analytics Application - Composition Wiring
 *
 * Instantiates the application service with concrete cross-domain adapters from
 * the composition layer. The HTTP interface layer imports the wired singleton.
 */

import { MlAnalyticsService } from "./ml-analytics-service.js";
import {
  mlAnalyticsStoreProvider,
  mlAnalyticsTwinProvider,
  mlAnalyticsEquipmentLookupProvider,
  mlAnalyticsPdmScoreProvider,
} from "../../../composition/ml-analytics-data.js";
import { insightsAnalyticsProvider } from "../../../composition/insights-analytics-data.js";

export { MlAnalyticsService } from "./ml-analytics-service.js";

export const mlAnalyticsService = new MlAnalyticsService(
  mlAnalyticsStoreProvider,
  mlAnalyticsTwinProvider,
  insightsAnalyticsProvider,
  mlAnalyticsEquipmentLookupProvider,
  mlAnalyticsPdmScoreProvider
);
