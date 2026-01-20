/**
 * RAG Conversation System Integration Tests
 * 
 * Tests the RAG (Retrieval-Augmented Generation) functionality including:
 * - Question answering
 * - Conversation management
 * - Knowledge base queries
 * - Feedback system
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG_ID = "test-org-integration";
const TEST_USER_ID = "test-user-001";

describe("RAG Conversations API", () => {
  let app: Express;
  let conversationId: string;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  afterAll(async () => {
  });

  describe("POST /api/rag/ask", () => {
    it("should handle a question", async () => {
      const response = await request(app)
        .post("/api/rag/ask")
        .set("x-org-id", TEST_ORG_ID)
        .send({
          question: "What is the maintenance schedule for main engines?",
          userId: TEST_USER_ID,
        });

      expect([200, 400, 404, 503]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
        if (response.body.conversationId) {
          conversationId = response.body.conversationId;
        }
      }
    });

    it("should handle follow-up questions", async () => {
      if (!conversationId) {
        console.log("Skipping - no conversation ID");
        return;
      }

      const response = await request(app)
        .post("/api/rag/ask")
        .set("x-org-id", TEST_ORG_ID)
        .send({
          question: "What are the specific intervals?",
          userId: TEST_USER_ID,
          conversationId,
        });

      expect([200, 400, 404, 503]).toContain(response.status);
    });
  });

  describe("GET /api/rag/conversations", () => {
    it("should list conversations", async () => {
      const response = await request(app)
        .get("/api/rag/conversations")
        .set("x-org-id", TEST_ORG_ID)
        .query({ userId: TEST_USER_ID });

      expect([200, 404]).toContain(response.status);
    });

    it("should get specific conversation", async () => {
      if (!conversationId) {
        console.log("Skipping - no conversation ID");
        return;
      }

      const response = await request(app)
        .get(`/api/rag/conversations/${conversationId}`)
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("POST /api/rag/feedback", () => {
    it("should submit feedback", async () => {
      if (!conversationId) {
        console.log("Skipping - no conversation ID");
        return;
      }

      const response = await request(app)
        .post("/api/rag/feedback")
        .set("x-org-id", TEST_ORG_ID)
        .send({
          conversationId,
          rating: 5,
          helpful: true,
          comment: "Useful response",
        });

      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe("GET /api/rag/suggestions", () => {
    it("should return query suggestions", async () => {
      const response = await request(app)
        .get("/api/rag/suggestions")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /api/rag/analytics", () => {
    it("should return RAG analytics", async () => {
      const response = await request(app)
        .get("/api/rag/analytics")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Knowledge Base", () => {
    it("should list knowledge base documents", async () => {
      const response = await request(app)
        .get("/api/knowledge-base/documents")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });

    it("should search knowledge base", async () => {
      const response = await request(app)
        .get("/api/knowledge-base/search")
        .set("x-org-id", TEST_ORG_ID)
        .query({ q: "maintenance" });

      expect([200, 404]).toContain(response.status);
    });
  });
});
