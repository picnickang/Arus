/**
 * Session Management Service - Backward Compatible Shim
 * Delegates to modular files in ./session-management/
 */

export type { SessionConfig, TokenPair, SessionValidationResult, LoginEventInput, CreateSessionOptions, SuspiciousActivityResult } from './session-management/index.js';
export { DEFAULT_SESSION_CONFIG, generateToken, hashToken, createSession, validateSession, revokeSession, revokeAllUserSessions, cleanupExpiredSessions, getUserSessions, logLoginEvent, getLoginEvents, detectSuspiciousActivity, SessionManagementService, sessionManagementService } from './session-management/index.js';
