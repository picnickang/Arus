/**
 * RAG route contract coverage.
 *
 * This suite mounts the real RAG router with a deterministic session shim so
 * the tests exercise current auth, validation, and conversation ownership
 * behavior without relying on a manually running localhost server.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import request from "supertest";

type RagServicesModule = typeof import("../../server/services/rag");
let getConversationService: RagServicesModule["getConversationService"];
let getFeedbackService: RagServicesModule["getFeedbackService"];

const TEST_ORG_ID = "test-org-rag-contract";
const TEST_USER_ID = "test-user-rag-contract";

type SessionShape = { userId?: string; orgId?: string };

let app: Express;
let currentSession: SessionShape | undefined;
const createdConversationIds = new Set<string>();

const noopRateLimit = ((_req: Request, _res: Response, next: NextFunction) =>
  next()) as unknown as RateLimitRequestHandler;

function authenticate() {
  currentSession = { userId: TEST_USER_ID, orgId: TEST_ORG_ID };
}

function unauthenticate() {
  currentSession = undefined;
}

function isClosedLibsqlClientError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("CLIENT_CLOSED");
}

beforeAll(async () => {
  process.env["NODE_ENV"] = "test";

  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentSession) {
      (req as Request & { session?: SessionShape }).session = currentSession;
    }
    next();
  });

  const routesMod = await import("../../server/routes/rag-routes");
  const ragServicesMod = await import("../../server/services/rag");
  getConversationService = ragServicesMod.getConversationService;
  getFeedbackService = ragServicesMod.getFeedbackService;

  routesMod.registerRagRoutes(app, {
    generalApiRateLimit: noopRateLimit,
    reportGenerationRateLimit: noopRateLimit,
  });
}, 60000);

beforeEach(() => {
  authenticate();
});

afterAll(async () => {
  const service = getConversationService?.();
  if (!service) {
    return;
  }

  try {
    await Promise.all(
      [...createdConversationIds].map((conversationId) =>
        service.deleteConversation(conversationId)
      )
    );
  } catch (error) {
    if (isClosedLibsqlClientError(error)) {
      return;
    }
    throw error;
  }
});

describe("RAG Conversations API", () => {
  describe("authentication and ask validation", () => {
    it("rejects unauthenticated RAG requests", async () => {
      unauthenticate();

      const response = await request(app).post("/api/rag/ask").send({
        query: "What is the maintenance schedule for main engines?",
      });

      expect(response.status).toBe(401);
    });

    it("rejects the legacy question payload shape", async () => {
      const response = await request(app).post("/api/rag/ask").send({
        question: "What is the maintenance schedule for main engines?",
        userId: TEST_USER_ID,
      });

      expect(response.status).toBe(400);
      expect(response.body?.message).toMatch(/Validation error/i);
      expect(response.body?.errors?.[0]?.path).toEqual(["query"]);
    });

    it("accepts the current query payload shape up to the runtime dependency boundary", async () => {
      const response = await request(app).post("/api/rag/ask").send({
        query: "What is the maintenance schedule for main engines?",
      });

      expect([200, 503]).toContain(response.status);
      if (response.status === 200 && response.body?.conversationId) {
        createdConversationIds.add(response.body.conversationId);
      }
      if (response.status === 503) {
        expect(response.body?.error).toMatch(/OpenAI API key/i);
      }
    });
  });

  describe("conversation lifecycle", () => {
    it("creates, lists, and reads conversations for the authenticated user", async () => {
      const created = await request(app)
        .post("/api/rag/conversations")
        .send({ title: "Contract test conversation" })
        .expect(201);

      createdConversationIds.add(created.body.id);

      const listed = await request(app)
        .get("/api/rag/conversations")
        .query({ limit: 10 })
        .expect(200);
      expect(Array.isArray(listed.body)).toBe(true);
      expect(
        listed.body.some((conversation: { id: string }) => conversation.id === created.body.id)
      ).toBe(true);

      const detail = await request(app)
        .get(`/api/rag/conversations/${created.body.id}`)
        .expect(200);
      expect(detail.body?.conversation?.id).toBe(created.body.id);
      expect(Array.isArray(detail.body?.messages)).toBe(true);
    });

    it("updates and deletes an owned conversation", async () => {
      const created = await request(app)
        .post("/api/rag/conversations")
        .send({ title: "Conversation before update" })
        .expect(201);
      createdConversationIds.add(created.body.id);

      const updated = await request(app)
        .patch(`/api/rag/conversations/${created.body.id}`)
        .send({ title: "Conversation after update" })
        .expect(200);
      expect(updated.body?.title).toBe("Conversation after update");

      await request(app).delete(`/api/rag/conversations/${created.body.id}`).expect(204);
      createdConversationIds.delete(created.body.id);

      await request(app).get(`/api/rag/conversations/${created.body.id}`).expect(404);
    });
  });

  describe("supporting RAG endpoints", () => {
    it("validates feedback with the current feedback schema", async () => {
      const queryText = `maintenance interval ${Date.now()}`;

      const response = await request(app).post("/api/rag/feedback").send({
        feedbackType: "helpful",
        rating: 5,
        queryText,
        comment: "Useful response",
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ success: true });

      const feedback = await getFeedbackService().getFeedback({
        orgId: TEST_ORG_ID,
        limit: 20,
      });
      const created = feedback.find((entry) => entry.queryText === queryText);
      expect(created?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(created?.feedbackType).toBe("helpful");
    });

    it("returns deterministic suggestion and analytics envelopes", async () => {
      const [suggestions, analytics] = await Promise.all([
        request(app).get("/api/rag/suggestions").expect(200),
        request(app).get("/api/rag/analytics").expect(200),
      ]);

      expect(suggestions.body).toHaveProperty("success", true);
      expect(Array.isArray(suggestions.body.suggestions)).toBe(true);
      expect(analytics.body).toHaveProperty("success", true);
      expect(analytics.body).toHaveProperty("analytics");
    });
  });
});
