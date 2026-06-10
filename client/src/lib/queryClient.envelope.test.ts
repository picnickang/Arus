/**
 * Seed test for apiRequest behavior under the response-envelope migration:
 * legacy bodies pass through, {success, data} unwraps, errors become ApiError.
 */

import { describe, it, expect } from "@jest/globals";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { envelope, errorEnvelope } from "@/test/msw/handlers";
import { apiRequest } from "./queryClient";
import { ApiError } from "./api-error";

describe("apiRequest envelope handling", () => {
  it("returns legacy bodies as-is", async () => {
    server.use(http.get("/api/equipment", () => HttpResponse.json([{ id: "eq-1" }])));
    const result = await apiRequest<{ id: string }[]>("GET", "/api/equipment");
    expect(result).toEqual([{ id: "eq-1" }]);
  });

  it("unwraps {success, data} envelopes", async () => {
    server.use(http.get("/api/equipment", () => HttpResponse.json(envelope([{ id: "eq-1" }]))));
    const result = await apiRequest<{ id: string }[]>("GET", "/api/equipment");
    expect(result).toEqual([{ id: "eq-1" }]);
  });

  it("throws ApiError with code from enveloped error bodies", async () => {
    server.use(
      http.get("/api/equipment", () => errorEnvelope(403, "FORBIDDEN", "Not your vessel"))
    );
    const error = await apiRequest("GET", "/api/equipment").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe("FORBIDDEN");
    expect((error as ApiError).message).toBe("403: Not your vessel");
  });

  it("sends the Idempotency-Key on queueable mutations end to end", async () => {
    let receivedKey: string | null = null;
    server.use(
      http.post("/api/work-orders", ({ request }) => {
        receivedKey = request.headers.get("Idempotency-Key");
        return HttpResponse.json(envelope({ id: "wo-1" }), { status: 201 });
      })
    );
    const created = await apiRequest<{ id: string }>("POST", "/api/work-orders", {
      title: "Inspect cooling pump",
    });
    expect(created.id).toBe("wo-1");
    expect(receivedKey).toMatch(/^client-mutation:/);
  });
});
