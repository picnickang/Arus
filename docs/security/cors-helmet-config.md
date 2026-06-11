# CORS & Helmet Security Configuration

This document describes the security middleware configuration for the ARUS Marine API.

## Quick Reference

| Feature     | Status  | Configuration                      |
| ----------- | ------- | ---------------------------------- |
| Helmet CSP  | Enabled | Environment-specific directives    |
| HSTS        | Enabled | 1 year, includeSubDomains, preload |
| CORS        | Enabled | Wildcard pattern matching          |
| Trust Proxy | Enabled | For Replit multi-proxy chain       |

## Helmet Configuration

### Content Security Policy (CSP)

CSP directives vary by environment to balance security with development needs:

```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],

      // Environment-specific
      scriptSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Dev: allow hot reload
        : ["'self'"], // Prod: strict

      imgSrc: ["'self'", "data:", "https:", "blob:"],

      connectSrc: isDevelopment
        ? ["'self'", "ws:", "wss:", "https:", "http:"]
        : ["'self'", "wss:", "https://api.openai.com"],

      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for dev
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});
```

### HSTS (HTTP Strict Transport Security)

- **maxAge**: 31536000 (1 year)
- **includeSubDomains**: true
- **preload**: true (eligible for browser preload lists)

## CORS Configuration

### Allowed Origins

Origins are matched using safe wildcard patterns:

```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "*.replit.dev",
  "*.replit.dev:*", // Replit dev with any port
  "*.replit.app",
  "*.replit.co",
  "http://localhost:*",
  "https://localhost:*",
];
```

### CORS Options

```typescript
cors({
  origin: corsOriginFunction, // Custom wildcard matcher
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Device-Id",
    "X-Equipment-Id",
    "X-HMAC-Signature",
    "x-org-id",
    "x-correlation-id",
  ],
  exposedHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "x-correlation-id",
  ],
});
```

### Wildcard Pattern Matching

The `originAllowed()` function in `server/utils/corsWildcard.ts` provides safe wildcard matching:

- `*` matches any characters
- All regex metacharacters are properly escaped
- Pattern must match entire origin string

## Additional Security Headers

Applied via `additionalSecurityHeaders` middleware (`server/security.ts`):

| Header                 | Value                                        | Purpose                    |
| ---------------------- | -------------------------------------------- | -------------------------- |
| X-Content-Type-Options | nosniff                                      | Prevent MIME sniffing      |
| Referrer-Policy        | strict-origin-when-cross-origin              | Privacy protection         |
| Permissions-Policy     | geolocation=(), microphone=()...             | Disable dangerous features |
| Cache-Control          | no-store, no-cache, must-revalidate, private | API responses              |

## Request Security Middleware

Order of application (in `server/index.ts`):

1. **Helmet** - Security headers
2. **CORS** - Origin validation
3. **additionalSecurityHeaders** - Extra headers
4. **detectAttackPatterns** - SQL injection, XSS, path traversal detection
5. **sanitizeRequestData** - Input sanitization

## Environment Variables

| Variable        | Description                     | Default                     |
| --------------- | ------------------------------- | --------------------------- |
| ALLOWED_ORIGINS | Comma-separated origin patterns | Replit + localhost patterns |
| NODE_ENV        | Environment mode                | development                 |

## Customization

To add custom allowed origins:

```bash
# In .env or environment
ALLOWED_ORIGINS=https://myapp.com,https://*.mycompany.com
```

## Security Monitoring

CORS blocks are logged in development mode only:

```
🚨 CORS: Blocked origin https://unauthorized.com
```

Attack pattern detection logs:

```
🚨 Potential security threat detected from IP on METHOD /path
```

## Related Files

- `server/index.ts` - Main security middleware configuration
- `server/security.ts` - Additional security utilities
- `server/utils/corsWildcard.ts` - Safe wildcard pattern matching
- `server/middleware/auth.ts` - Authentication middleware
