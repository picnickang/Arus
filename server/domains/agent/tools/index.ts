import "./equipment-tools";
import "./maintenance-tools";
import "./alert-tools";
import "./prediction-tools";
import "./crew-tools";
import "./inventory-tools";
import "./work-order-tools";
import "./report-tools";
import "./enhanced-report-tools";
import "./file-analysis-tools";
import "./knowledge-base-tools";
import "./weather-tools";
import "./regulatory-tools";
import "./parts-supplier-tools";
import "./task-finding-tools";

import { registerListAvailableToolsMeta } from "./registry";
registerListAvailableToolsMeta();

export { getTool, getAllTools, getToolOpenAIDefinitions, getToolSummaries, getRegisteredToolNames, getToolsByCategory, getToolCategorySummary } from "./registry";
export type { ToolDefinition, ToolContext, ToolCategory } from "../domain/types";
