import { SAMPLE_DATA } from "./constants";

export function replaceVariables(template: string, data: typeof SAMPLE_DATA): string {
  let result = template;
  
  const flattenData = (obj: Record<string, unknown>, prefix = ""): Record<string, string> => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        Object.assign(flat, flattenData(value as Record<string, unknown>, fullKey));
      } else {
        flat[fullKey] = String(value ?? "");
      }
    }
    return flat;
  };

  const flatData = flattenData(data);
  for (const [key, value] of Object.entries(flatData)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  
  return result;
}
