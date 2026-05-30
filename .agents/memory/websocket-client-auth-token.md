---
name: WebSocket client auth token source
description: Where the browser WS client must read the session token from, and why localStorage is wrong.
---

# WebSocket client auth token source

The browser session/auth token lives in an **in-memory registry**
(`client/src/lib/sessionToken.ts` → `getApiSessionToken()` /
`setApiSessionToken()` / `subscribeToApiSessionToken()`). It is deliberately
**not** stored in `localStorage`/`sessionStorage`.

**Why:** keeping the token out of web storage reduces XSS blast radius. The
REST API client reads it via `getApiSessionToken()` and sets the bearer header.

**How to apply:** any code that needs the token (notably the native
`WebSocket` upgrade in `client/src/hooks/useWebSocket.ts`, which can only pass
the token as a `?token=` query param) MUST read it from `getApiSessionToken()`.
Reading `localStorage.getItem("sessionToken")` always returns null, so the WS
upgrade runs anonymously and the server resolves the wrong tenant (falls back to
`DEFAULT_ORG_ID` when `REQUIRE_TENANT_AUTH` is off, or is rejected when on) —
this silently breaks any realtime/tenant-scoped channel. Also resubscribe/
reconnect on token change (`subscribeToApiSessionToken`) so login/logout/tenant
switch rebinds the socket to the new org.
