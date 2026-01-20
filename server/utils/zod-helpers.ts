/**
 * Shared Zod preprocessing utilities
 * Reduces code duplication across domain routes
 */

/**
 * Preprocess date fields in request body
 * Converts ISO strings and timestamps to Date objects before Zod validation
 */
export function preprocessDates<T extends Record<string, any>>(
  body: T,
  dateFields: (keyof T)[]
): T {
  const processed = { ...body };

  for (const field of dateFields) {
    if (processed[field]) {
      processed[field] = new Date(processed[field] as any);
    }
  }

  return processed;
}

/**
 * Common date fields used across domains
 */
export const COMMON_DATE_FIELDS = {
  workOrders: ["scheduledDate", "completedDate", "plannedStartDate", "plannedEndDate"] as const,
  completion: [
    "completedAt",
    "plannedStartDate",
    "plannedEndDate",
    "actualStartDate",
    "actualEndDate",
  ] as const,
  maintenance: ["scheduledDate", "completedDate", "dueDate"] as const,
  crew: ["startDate", "endDate", "expiryDate", "issueDate"] as const,
} as const;
