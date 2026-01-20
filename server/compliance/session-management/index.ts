/**
 * Session Management - Modular Exports
 */

export type { SessionConfig, TokenPair, SessionValidationResult, LoginEventInput, CreateSessionOptions, SuspiciousActivityResult } from './types.js';
export { DEFAULT_SESSION_CONFIG } from './types.js';
export { generateToken, hashToken } from './token-utils.js';
export { createSession, validateSession, revokeSession, revokeAllUserSessions } from './session-ops.js';
export { cleanupExpiredSessions, getUserSessions } from './session-queries.js';
export { logLoginEvent, getLoginEvents, detectSuspiciousActivity } from './login-events.js';
export { SessionManagementService, sessionManagementService } from './service.js';
