---
name: Admin auth model (no shared-password unlock)
description: How admin access is granted in ARUS after the shared-password unlock was retired.
---

# Admin auth model

A shared admin password is NOT a sign-in path anywhere in ARUS. Admins
authenticate with a real per-user account; admin authority is derived from that
account's role, not from possession of a shared secret. This holds across web
**and** the desktop build — the desktop setup wizard ends in a real account
login, not a password gate.

**Why:** a shared password that mints an admin session is an unaccountable,
unrevocable credential. Real accounts give per-user identity, RBAC, and audit.

**How to apply:** never reintroduce a route, context method, or setup step that
turns a shared password into an admin session. Admin-bootstrap setup may persist
a credential hash, but it must not mint a session. Per-user session minting in
the storage layer (used by real-account login) is legitimate and unrelated to
the retired shared-password path.
