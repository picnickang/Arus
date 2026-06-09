/**
 * Task #259 regression: RAG conversation access must be gated on per-user
 * ownership, not on the no-op single-tenant org check it had before.
 *
 * Previously `GET /:id/messages`, `PATCH /:id`, `DELETE /:id`, the export
 * path and the streaming history load performed no effective ownership
 * check, so any caller could read or mutate another user's conversation by
 * guessing its id. Every conversation read/write now funnels through
 * `ConversationService.getOwnedConversation`, which keys on `userId` (with
 * org as defense-in-depth) and returns not-found for non-owners. Legacy
 * conversations with a null `userId` stay accessible within the org so
 * existing owners are not locked out.
 *
 * The test mirrors the session-shim harness used by the RAG security admin
 * gate test: a minimal Express app injects `req.session`, then
 * `ragAuthMiddleware` (mounted by `registerRagRoutes`) derives the trusted
 * `ragContext` identity from it.
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import request from "supertest";

// The RAG route module pulls in a heavy dependency chain (openai,
// repositories) that only transforms cleanly under jest's ESM transform via
// dynamic import — the same pattern the other server-route integration tests
// use. `typeof import(...)` below is a type-only construct and does not
// trigger any runtime transform.
type RagServicesModule = typeof import("../../server/services/rag");
type RagSecurityModule = typeof import("../../server/services/rag/security");
let getConversationService: RagServicesModule["getConversationService"];
let getRagSecurityServices: RagSecurityModule["getRagSecurityServices"];

const TEST_ORG = "test-org-ownership";
const USER_A = "user-a-owner";
const USER_B = "user-b-other";

type SessionShape = { userId?: string; orgId?: string };

let app: Express;
let currentSession: SessionShape | undefined;

let ownerConvId: string;
let otherConvId: string;
let legacyConvId: string;

function isClosedLibsqlClientError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("CLIENT_CLOSED");
}

const noopRateLimit = ((_req: Request, _res: Response, next: NextFunction) =>
  next()) as unknown as RateLimitRequestHandler;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  // Auth shim — stands in for the real session middleware so ragAuthMiddleware
  // can build ragContext from a trusted (non-spoofable) identity.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentSession) {
      (req as Request & { session?: SessionShape }).session = currentSession;
    }
    next();
  });

  const routesMod = await import("../../server/routes/rag-routes");
  const ragServicesMod = await import("../../server/services/rag");
  const ragSecurityMod = await import("../../server/services/rag/security");
  getConversationService = ragServicesMod.getConversationService;
  getRagSecurityServices = ragSecurityMod.getRagSecurityServices;

  routesMod.registerRagRoutes(app, {
    generalApiRateLimit: noopRateLimit,
    reportGenerationRateLimit: noopRateLimit,
  });

  const service = getConversationService();
  const ownerConv = await service.createConversation({
    orgId: TEST_ORG,
    userId: USER_A,
    title: "Owner conversation",
  });
  const otherConv = await service.createConversation({
    orgId: TEST_ORG,
    userId: USER_B,
    title: "Other user's conversation",
  });
  const legacyConv = await service.createConversation({
    orgId: TEST_ORG,
    userId: undefined,
    title: "Legacy conversation (no owner)",
  });
  ownerConvId = ownerConv.id;
  otherConvId = otherConv.id;
  legacyConvId = legacyConv.id;

  // Seed a message into the other user's conversation so denial is proven
  // against real data, not just an empty thread.
  await service.addMessage({
    conversationId: otherConvId,
    role: "user",
    content: "secret question from user B",
  });

  // All HTTP requests below act as USER_A unless they use a streaming token.
  currentSession = { userId: USER_A, orgId: TEST_ORG };
}, 60000);

afterAll(async () => {
  const service = getConversationService();
  try {
    await Promise.all(
      [ownerConvId, otherConvId, legacyConvId]
        .filter(Boolean)
        .map((id) => service.deleteConversation(id))
    );
  } catch (error) {
    if (isClosedLibsqlClientError(error)) {
      return;
    }
    throw error;
  }
});

describe("Task #259 — RAG conversation ownership", () => {
  describe("read", () => {
    it("lets the owner read their own conversation", async () => {
      const res = await request(app).get(`/api/rag/conversations/${ownerConvId}`);
      expect(res.status).toBe(200);
      expect(res.body?.conversation?.id).toBe(ownerConvId);
    });

    it("denies a non-owner reading another user's conversation (404)", async () => {
      const res = await request(app).get(`/api/rag/conversations/${otherConvId}`);
      expect(res.status).toBe(404);
    });

    it("keeps legacy null-owner conversations accessible within the org", async () => {
      const res = await request(app).get(`/api/rag/conversations/${legacyConvId}`);
      expect(res.status).toBe(200);
      expect(res.body?.conversation?.id).toBe(legacyConvId);
    });
  });

  describe("messages", () => {
    it("lets the owner read their own messages", async () => {
      const res = await request(app).get(`/api/rag/conversations/${ownerConvId}/messages`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("denies a non-owner reading another user's messages (404)", async () => {
      const res = await request(app).get(`/api/rag/conversations/${otherConvId}/messages`);
      expect(res.status).toBe(404);
    });
  });

  describe("export", () => {
    it("lets the owner export their own conversation", async () => {
      const res = await request(app).get(
        `/api/rag/conversations/${ownerConvId}/export?format=markdown`
      );
      expect(res.status).toBe(200);
    });

    it("denies a non-owner exporting another user's conversation (404)", async () => {
      const res = await request(app).get(
        `/api/rag/conversations/${otherConvId}/export?format=markdown`
      );
      expect(res.status).toBe(404);
    });
  });

  describe("mutations", () => {
    it("denies a non-owner updating another user's conversation (404)", async () => {
      const res = await request(app)
        .patch(`/api/rag/conversations/${otherConvId}`)
        .send({ title: "hijacked" });
      expect(res.status).toBe(404);
    });

    it("denies a non-owner deleting another user's conversation (404)", async () => {
      const res = await request(app).delete(`/api/rag/conversations/${otherConvId}`);
      expect(res.status).toBe(404);
    });

    it("does not delete the other user's conversation after a denied attempt", async () => {
      const stillThere = await getConversationService().getConversation(otherConvId);
      expect(stillThere?.id).toBe(otherConvId);
    });
  });

  describe("ask (non-streaming)", () => {
    it("denies appending to a non-owned conversation via /ask (404, no write)", async () => {
      // The ownership gate runs before the orchestrator, so this is rejected
      // deterministically without invoking OpenAI — and no message is written
      // to the other user's thread.
      const before = await getConversationService().getMessages(otherConvId, 100);
      const res = await request(app)
        .post("/api/rag/ask")
        .send({ query: "inject into another user's thread", conversationId: otherConvId });
      expect(res.status).toBe(404);
      const after = await getConversationService().getMessages(otherConvId, 100);
      expect(after.length).toBe(before.length);
    });
  });

  describe("stream history", () => {
    it("denies a non-owner loading another user's conversation history (404)", async () => {
      // A valid streaming token authenticates USER_A; the ownership gate now
      // runs before any OpenAI/search work, so a non-owned conversationId is
      // rejected deterministically with 404.
      const token = getRagSecurityServices().tokenService.generateToken(USER_A, TEST_ORG);
      const res = await request(app)
        .get("/api/rag/ask-stream")
        .query({ token, conversationId: otherConvId, query: "hello" });
      expect(res.status).toBe(404);
    });
  });
});
