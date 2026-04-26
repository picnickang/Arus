/**
 * In-memory API session token registry.
 *
 * The token intentionally stays out of localStorage/sessionStorage to reduce XSS blast radius.
 * React contexts can update it, while queryClient/admin-api can read it without importing React.
 */
let currentSessionToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getApiSessionToken(): string | null {
  return currentSessionToken;
}

export function setApiSessionToken(token: string | null): void {
  currentSessionToken = token;
  listeners.forEach((listener) => listener(token));
}

export function subscribeToApiSessionToken(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
