import { http, HttpResponse } from "msw";

/**
 * Baseline handlers. Tests add scenario-specific handlers with
 * `server.use(...)`; these only cover endpoints touched incidentally by many
 * hooks so unrelated tests don't fail on unhandled requests.
 *
 * `envelope()` wraps a payload the way the server's canonical response
 * envelope does — handlers can serve either shape to prove the client treats
 * the migration transparently.
 */

export function envelope<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function errorEnvelope(status: number, code: string, message: string) {
  return HttpResponse.json({ success: false, error: { code, message }, message }, { status });
}

export const handlers = [http.post("/api/error-logs", () => HttpResponse.json({ ok: true }))];
