import type { ToolDefinition } from "../domain/types";

const tools: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function getToolSummaries(): { name: string; description: string; requiresApproval: boolean }[] {
  return getAllTools().map(t => ({
    name: t.name,
    description: t.description,
    requiresApproval: t.requiresApproval,
  }));
}

export function getToolOpenAIDefinitions(enabledTools?: string[] | null) {
  let filtered = getAllTools();
  if (enabledTools !== null && enabledTools !== undefined) {
    filtered = filtered.filter(t => enabledTools.includes(t.name));
  }
  return filtered.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
