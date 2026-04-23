export const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "application/pdf", "text/csv"];

export const MAX_RETRIES = 3;
export const RETRY_BASE_MS = 1000;
export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const SUGGESTED_PROMPTS = [
  "Show riskiest equipment",
  "Open alerts summary",
  "Maintenance schedule overview",
];

export function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
