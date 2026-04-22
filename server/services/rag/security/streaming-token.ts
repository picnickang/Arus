/**
 * Streaming Token Service
 * Generates short-lived signed tokens for SSE streaming endpoints
 * Workaround for EventSource which cannot send headers
 */

import crypto from "crypto";
import { logger } from "../../../utils/logger.js";
import type { RagSecurityConfig } from "./types.js";

interface TokenPayload {
  userId: string;
  orgId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface TokenStore {
  tokens: Map<string, TokenPayload>;
  usedNonces: Set<string>;
}

const tokenStore: TokenStore = {
  tokens: new Map(),
  usedNonces: new Set(),
};

// Clean up expired tokens every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, payload] of tokenStore.tokens.entries()) {
    if (payload.expiresAt < now) {
      tokenStore.tokens.delete(token);
    }
  }
  // Clean up old nonces (keep last 10000)
  if (tokenStore.usedNonces.size > 10000) {
    const noncesArray = Array.from(tokenStore.usedNonces);
    tokenStore.usedNonces = new Set(noncesArray.slice(-5000));
  }
}, 60000);

// Secret key for signing tokens (should be from env in production)
const SECRET_KEY = process.env.RAG_STREAMING_SECRET || crypto.randomBytes(32).toString('hex');

export class StreamingTokenService {
  private config: RagSecurityConfig['auth'];

  constructor(config: RagSecurityConfig['auth']) {
    this.config = config;
  }

  /**
   * Generate a short-lived streaming token
   */
  generateToken(userId: string, orgId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const issuedAt = Date.now();
    const expiresAt = issuedAt + (this.config.streamingTokenTTLSeconds * 1000);

    const payload: TokenPayload = {
      userId,
      orgId,
      issuedAt,
      expiresAt,
      nonce,
    };

    // Create signed token
    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payloadStr)
      .digest('hex');

    const token = `${Buffer.from(payloadStr).toString('base64')  }.${  signature}`;

    // Store for validation
    tokenStore.tokens.set(token, payload);

    logger.debug("StreamingToken", `Generated token for user ${userId}`, {
      expiresIn: this.config.streamingTokenTTLSeconds,
    });

    return token;
  }

  /**
   * Validate and consume a streaming token
   * Returns the payload if valid, null otherwise
   */
  validateToken(token: string): TokenPayload | null {
    if (!token) {
      return null;
    }

    try {
      const [encodedPayload, signature] = token.split('.');
      if (!encodedPayload || !signature) {
        logger.warn("StreamingToken", "Invalid token format");
        return null;
      }

      const payloadStr = Buffer.from(encodedPayload, 'base64').toString('utf-8');
      
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(payloadStr)
        .digest('hex');

      if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        logger.warn("StreamingToken", "Invalid token signature");
        return null;
      }

      const payload: TokenPayload = JSON.parse(payloadStr);

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        logger.warn("StreamingToken", "Token expired");
        tokenStore.tokens.delete(token);
        return null;
      }

      // Check nonce reuse (prevent replay attacks)
      if (tokenStore.usedNonces.has(payload.nonce)) {
        logger.warn("StreamingToken", "Token nonce already used (replay attack?)");
        return null;
      }

      // Mark nonce as used
      tokenStore.usedNonces.add(payload.nonce);

      // Remove token after single use
      tokenStore.tokens.delete(token);

      return payload;
    } catch (error) {
      logger.error("StreamingToken", "Token validation error", error);
      return null;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  revokeUserTokens(userId: string): number {
    let revoked = 0;
    for (const [token, payload] of tokenStore.tokens.entries()) {
      if (payload.userId === userId) {
        tokenStore.tokens.delete(token);
        revoked++;
      }
    }
    return revoked;
  }

  updateConfig(config: RagSecurityConfig['auth']): void {
    this.config = config;
  }
}

let instance: StreamingTokenService | null = null;

export function getStreamingTokenService(config: RagSecurityConfig['auth']): StreamingTokenService {
  if (!instance) {
    instance = new StreamingTokenService(config);
  }
  return instance;
}

export function updateStreamingTokenConfig(config: RagSecurityConfig['auth']): void {
  if (instance) {
    instance.updateConfig(config);
  }
}
