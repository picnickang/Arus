# Media Persistence Proof

## Status

Partial proof exists. KB upload and object storage boundaries are covered in the embedded lane. Vessel schematics, registry thumbnails, crew photos, and documents still need full upload/replace/delete proof.

## Evidence

| Media Area                           | Evidence                                                      | Result                |
| ------------------------------------ | ------------------------------------------------------------- | --------------------- |
| KB uploads                           | `tests/integration/kb-upload-reliability.test.ts`             | Pass in embedded lane |
| Object storage client initialization | `tests/integration/object-storage-client-concurrency.test.ts` | Pass in embedded lane |
| Vessel diagram registry API          | `tests/integration/vessel-diagram-registry-routes.test.ts`    | Pass in embedded lane |

## Remaining Gaps

- Vessel schematic upload/replace/delete media persistence needs end-to-end file and DB verification.
- Registry section/equipment thumbnail upload/delete needs deterministic proof.
- Crew photo object serving exists as a suite but is not yet in the embedded lane.
- Document upload/delete and broken-reference behavior need deterministic proof.

## Required Before Full Production

- Add or migrate deterministic tests covering MIME validation, size validation, DB record creation, storage reference existence, tenant ownership, delete/replace behavior, and broken-reference safety for each media type.
