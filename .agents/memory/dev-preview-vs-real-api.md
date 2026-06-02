---
name: Dev preview domain vs real API port
description: Where the real ARUS backend actually answers during local/dev smoke tests
---

When this project has the mockup-sandbox workflow running alongside `Start application`,
`$REPLIT_DEV_DOMAIN` (the public preview URL) routes to the **mockup-sandbox Vite
preview server** (it answers with a `/__mockup/` base-URL hint and 404s on `/api/*`),
NOT the real Express API.

**How to apply:** Smoke-test the real backend at `http://localhost:5000` directly
(that is where `npm run dev` / `Start application` serves the API). Hitting the dev
domain for `/api/...` will mislead you with 404s that are not real route bugs.

**Why:** Wasted a debugging cycle chasing a phantom "route not registered" 404 that
was just the mockup preview server intercepting the public domain.
