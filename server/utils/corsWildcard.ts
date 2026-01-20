/**
 * CORS Wildcard Utilities
 * Safe wildcard pattern matching with proper regex escaping
 */

/**
 * Convert wildcard pattern to safe regex
 * Escapes all regex metacharacters except * which becomes [^/]* (non-greedy, bounded)
 *
 * Strategy: Replace * with placeholder, escape everything, then replace placeholder with bounded pattern
 */
export function wildcardToRegex(pat: string): RegExp {
  const trimmed = pat.trim().slice(0, 256);
  const withPlaceholder = trimmed.replace(/\*/g, "__WILDCARD_STAR__");
  const escaped = withPlaceholder.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replaceAll('__WILDCARD_STAR__', "[^/]*");
  return new RegExp(`^${pattern}$`);
}

/**
 * Check if origin is allowed by wildcard patterns
 */
export function originAllowed(origin: string, allowlist: string[]): boolean {
  return allowlist.some((p) => wildcardToRegex(p).test(origin));
}
