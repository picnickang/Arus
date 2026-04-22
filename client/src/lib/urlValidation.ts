export interface UrlValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
  isInsecure?: boolean;
}

export function validateBackendUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {return { valid: false, normalized: "", error: "URL is required" };}

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, normalized: trimmed, error: "Only http:// and https:// URLs are supported" };
    }
    if (!parsed.hostname) {
      return { valid: false, normalized: trimmed, error: "Invalid hostname" };
    }
    const normalized = parsed.origin;
    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    const isInsecure = parsed.protocol === "http:" && !isLocalhost;
    return { valid: true, normalized, isInsecure };
  } catch {
    return { valid: false, normalized: trimmed, error: "Invalid URL format. Example: http://localhost:5000" };
  }
}
