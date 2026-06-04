---
name: GCS createReadStream options cast is load-bearing
description: The project's resolved @google-cloud/storage types don't expose createReadStream(options?), so the structural RangedRead cast must stay.
---

# Don't "clean up" the GCS createReadStream cast

In both object-storage modules (`server/objectStorage.ts` and
`server/replit_integrations/object_storage/objectStorage.ts`) the magic-byte sniff
calls `file.createReadStream({ start, end })` through a structural cast
(`file as unknown as RangedRead`). This cast is **load-bearing**: the
`@google-cloud/storage` types resolved for this project do not expose the
`createReadStream(options?)` overload, so removing the cast makes `tsc` fail with
"Expected 0 arguments, but got 1". The runtime fully supports the options arg.

By contrast, `file.name` **is** on the resolved `File` type — any
`(file as unknown as { name?: string }).name` cast around `.name` is redundant and
can be replaced with `file.name`.

**Why:** A type-debt sweep will see the `as unknown as RangedRead` and want to
delete it; doing so reintroduces a tsc error. Leave it (or replace only with an
equally-typed structural view), and keep the `.name` simplification.
