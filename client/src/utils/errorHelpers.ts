import { NormalizedError } from "@/components/patterns";

/**
 * Normalizes various error types (TanStack Query, Fetch, Error) into NormalizedError format
 */
export function normalizeQueryError(error: unknown): NormalizedError {
  // Handle null/undefined
  if (!error) {
    return {
      title: "Unknown Error",
      message: "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
    };
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check if it's a fetch/network error
    if (error.message.includes("Failed to fetch") || error.message.includes("Network")) {
      return {
        title: "Network Error",
        message: "Unable to connect to the server. Please check your internet connection.",
        code: "NETWORK_ERROR",
        details: error.stack,
      };
    }

    return {
      title: error.name || "Error",
      message: error.message,
      details: error.stack,
      code: error.name?.toUpperCase().replaceAll(' ', "_") || "GENERIC_ERROR",
    };
  }

  // Handle API error responses (with statusCode)
  if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Handle HTTP error responses
    if (errorObj.statusCode || errorObj.status) {
      const statusCode = errorObj.statusCode || errorObj.status;
      const message = errorObj.message || errorObj.error || getStatusMessage(statusCode);

      return {
        title: getStatusTitle(statusCode),
        message,
        statusCode,
        code: `HTTP_${statusCode}`,
        details: errorObj.details || errorObj.stack,
      };
    }

    // Handle error objects with message
    if (errorObj.message) {
      return {
        title: errorObj.title || "Error",
        message: errorObj.message,
        code: errorObj.code || "API_ERROR",
        details: errorObj.details || errorObj.stack,
      };
    }
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      title: "Error",
      message: error,
      code: "STRING_ERROR",
    };
  }

  // Fallback for unknown error types
  return {
    title: "Unexpected Error",
    message: "An unexpected error occurred. Please try again.",
    code: "UNKNOWN_ERROR",
    details: JSON.stringify(error),
  };
}

/**
 * Get human-friendly title for HTTP status codes
 */
function getStatusTitle(statusCode: number): string {
  if (statusCode >= 500) {
    return "Server Error";
  }

  if (statusCode === 404) {
    return "Not Found";
  }

  if (statusCode === 403) {
    return "Access Denied";
  }

  if (statusCode === 401) {
    return "Unauthorized";
  }

  if (statusCode === 400) {
    return "Bad Request";
  }
  return "Error";
}

/**
 * Get human-friendly message for HTTP status codes
 */
function getStatusMessage(statusCode: number): string {
  if (statusCode >= 500) {
    return "The server encountered an error. Please try again later.";
  }

  if (statusCode === 404) {
    return "The requested resource was not found.";
  }

  if (statusCode === 403) {
    return "You don't have permission to access this resource.";
  }

  if (statusCode === 401) {
    return "You need to be logged in to access this resource.";
  }

  if (statusCode === 400) {
    return "The request was invalid. Please check your input.";
  }
  return "An error occurred while processing your request.";
}
