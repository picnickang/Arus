/**
 * Attack Detection - Pattern-based threat identification
 *
 * SonarQube Fix: Reduced cognitive complexity through extraction and constants
 */

import { Request, Response, NextFunction } from "express";
import { flaggedIPs } from "./ip-tracking";

/** Paths that should skip attack pattern detection */
const SKIP_PATHS = ["/api/healthz", "/api/readyz", "/api/metrics", "/favicon.ico"];

/** Thresholds for IP blocking */
const BLOCKING_THRESHOLDS = {
  WARNING_COUNT: 3,
  BLOCK_COUNT: 5,
  BLOCK_DURATION_MS: 60 * 60 * 1000,
} as const;

/** Attack pattern categories for clear separation */
const ATTACK_PATTERNS = {
  sqlInjection: [
    /\bunion\s+select\b/i,
    /\bselect\s+\S{1,100}\s+from\s+/i,
    /\binsert\s+into\b/i,
    /\bupdate\s+\S{1,100}\s+set\b/i,
    /\bdelete\s+from\b/i,
    /\bdrop\s+table\b/i,
  ],
  xss: [
    // Detection-only: flag any opening <script tag (incl. `<script src=…`,
    // `<script\n>`); we don't need to match the closing tag for threat
    // scoring, which also avoids brittle/bypassable end-tag matching.
    /<script[\s/>]/i,
    /javascript:\s{0,10}[^;]/i,
    /on(?:load|error|click|focus|blur)\s{0,10}=/i,
  ],
  pathTraversal: [/\.\.[/\\][^/\\]{0,100}[/\\]/],
  commandInjection: [/[;&|`$]\s{0,10}(?:rm|cat|ls|wget|curl|nc|bash|sh)\b/i],
} as const;

type AttackCategory = keyof typeof ATTACK_PATTERNS;

interface PatternMatch {
  category: AttackCategory;
  pattern: RegExp;
}

/**
 * Check data against all attack patterns
 * Returns the first matching pattern or null
 */
function findMatchingPattern(data: string): PatternMatch | null {
  for (const [category, patterns] of Object.entries(ATTACK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(data)) {
        return { category: category as AttackCategory, pattern };
      }
    }
  }
  return null;
}

/**
 * Check if IP is currently blocked
 */
function isIPBlocked(clientIP: string): boolean {
  const ipInfo = flaggedIPs.get(clientIP);
  return !!(ipInfo?.blockedUntil && ipInfo.blockedUntil > new Date());
}

/**
 * Update IP tracking and determine if blocking is needed
 */
function updateIPTracking(clientIP: string): { shouldBlock: boolean; blockedUntil?: Date } {
  let ipInfo = flaggedIPs.get(clientIP);
  const now = new Date();

  if (ipInfo) {
    ipInfo.suspiciousActivityCount++;
    ipInfo.lastSeen = now;
  } else {
    ipInfo = { suspiciousActivityCount: 1, firstSeen: now, lastSeen: now };
    flaggedIPs.set(clientIP, ipInfo);
  }

  if (ipInfo.suspiciousActivityCount >= BLOCKING_THRESHOLDS.BLOCK_COUNT) {
    ipInfo.blockedUntil = new Date(now.getTime() + BLOCKING_THRESHOLDS.BLOCK_DURATION_MS);
    return { shouldBlock: true, blockedUntil: ipInfo.blockedUntil };
  }

  return { shouldBlock: false };
}

/**
 * Log security event with consistent format
 */
function logSecurityEvent(
  level: "warn" | "error",
  message: string,
  context: Record<string, unknown>
) {
  const logFn = level === "error" ? console.error : console.warn;
  logFn(`[SECURITY] ${message}`, context);
}

/**
 * Handle suspicious activity detection
 */
function handleSuspiciousActivity(
  clientIP: string,
  match: PatternMatch,
  req: Request,
  res: Response
): Response | null {
  logSecurityEvent("warn", "Potential attack detected", {
    ip: clientIP,
    method: req.method,
    path: req.path,
    category: match.category,
    pattern: match.pattern.source.substring(0, 20),
  });

  const { shouldBlock, blockedUntil } = updateIPTracking(clientIP);

  if (shouldBlock) {
    logSecurityEvent("error", "IP blocked", { ip: clientIP, blockedUntil });
    return res.status(429).json({
      error: "Too many suspicious requests",
      message: "Your IP has been temporarily blocked due to suspicious activity.",
      blockedUntil,
    });
  }

  const ipInfo = flaggedIPs.get(clientIP);
  if (ipInfo && ipInfo.suspiciousActivityCount >= BLOCKING_THRESHOLDS.WARNING_COUNT) {
    logSecurityEvent("warn", "IP approaching block threshold", {
      ip: clientIP,
      count: ipInfo.suspiciousActivityCount,
    });
  }

  return null;
}

/**
 * Serialize request data for pattern matching
 */
function serializeRequestData(req: Request): string {
  return JSON.stringify({
    query: req.query,
    params: req.params,
    body: req.body,
  });
}

/**
 * Extract client IP from request
 */
function getClientIP(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Check if request path should skip attack detection
 */
function shouldSkipPath(path: string): boolean {
  return SKIP_PATHS.some((skipPath) => path.startsWith(skipPath));
}

/**
 * Main middleware: Detect attack patterns in incoming requests
 *
 * Cognitive complexity reduced by extracting helper functions
 */
export function detectAttackPatterns(req: Request, res: Response, next: NextFunction) {
  if (shouldSkipPath(req.path)) {
    return next();
  }

  const clientIP = getClientIP(req);

  if (isIPBlocked(clientIP)) {
    const ipInfo = flaggedIPs.get(clientIP);
    return res.status(429).json({
      error: "IP temporarily blocked",
      message: "Your IP has been temporarily blocked due to suspicious activity.",
      blockedUntil: ipInfo?.blockedUntil,
    });
  }

  const sensitiveData = serializeRequestData(req);
  const match = findMatchingPattern(sensitiveData);

  if (match) {
    const response = handleSuspiciousActivity(clientIP, match, req, res);
    if (response) {
      return response;
    }
  }

  next();
}

/** Export for testing */
export const _internals = {
  findMatchingPattern,
  isIPBlocked,
  updateIPTracking,
  ATTACK_PATTERNS,
  BLOCKING_THRESHOLDS,
};
