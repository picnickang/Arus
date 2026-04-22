import type { ToolDefinition, ToolCategory } from "../domain/types";

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

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return getAllTools().filter((t) => t.category === category);
}

export function getToolSummaries(): {
  name: string;
  description: string;
  category: ToolCategory;
  requiresApproval: boolean;
}[] {
  return getAllTools().map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    requiresApproval: t.requiresApproval,
  }));
}

export function getRegisteredToolNames(): string[] {
  return Array.from(tools.keys());
}

export function getToolCategorySummary(): Record<
  string,
  { tools: { name: string; description: string; requiresApproval: boolean }[] }
> {
  const grouped: Record<
    string,
    { tools: { name: string; description: string; requiresApproval: boolean }[] }
  > = {};
  for (const tool of getAllTools()) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = { tools: [] };
    }
    grouped[tool.category].tools.push({
      name: tool.name,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
    });
  }
  return grouped;
}

const LIST_AVAILABLE_TOOLS_NAME = "listAvailableTools";

export function registerListAvailableToolsMeta(): void {
  registerTool({
    name: LIST_AVAILABLE_TOOLS_NAME,
    category: "meta",
    riskLevel: "read",
    description:
      "List all available tools grouped by category with brief descriptions. Call this tool first to discover what capabilities are available before requesting specific tools. After reviewing the list, you can call any tool directly — the system will load it for you.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Optional: filter to a specific category (fleet, maintenance, alerts, predictions, crew, inventory, work-orders, analytics, files, knowledge-base, compliance)",
        },
      },
      required: [],
    },
    requiresApproval: false,
    async execute(input: Record<string, unknown>) {
      const category = input.category as string | undefined;
      const allTools = getAllTools().filter((t) => t.name !== LIST_AVAILABLE_TOOLS_NAME);
      const filtered = category ? allTools.filter((t) => t.category === category) : allTools;

      const grouped: Record<
        string,
        { name: string; description: string; requiresApproval: boolean }[]
      > = {};
      for (const t of filtered) {
        if (!grouped[t.category]) {
          grouped[t.category] = [];
        }
        grouped[t.category].push({
          name: t.name,
          description: t.description,
          requiresApproval: t.requiresApproval,
        });
      }

      return {
        totalTools: filtered.length,
        categories: grouped,
        hint: "You can now call any of these tools directly. The system will make them available.",
      };
    },
  });
}

export type ToolLoadingMode = "full" | "light";

export function getToolOpenAIDefinitions(
  enabledTools?: string[] | null,
  options?: { mode?: ToolLoadingMode; activatedTools?: string[] }
) {
  const mode = options?.mode || "light";
  const activatedTools = options?.activatedTools || [];

  let filtered = getAllTools();

  if (Array.isArray(enabledTools) && enabledTools.length > 0) {
    filtered = filtered.filter(
      (t) => t.name === LIST_AVAILABLE_TOOLS_NAME || enabledTools.includes(t.name)
    );
  }

  if (mode === "light") {
    filtered = filtered.filter(
      (t) => t.name === LIST_AVAILABLE_TOOLS_NAME || activatedTools.includes(t.name)
    );
  }

  return filtered.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
