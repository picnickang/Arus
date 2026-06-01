# Crew Management Hardening Summary

## Changed Areas

- Active roster access readiness now uses expanded password/access states.
- Former Crew no longer reuses active-only access readiness filtering.
- Former Crew has dedicated access-risk filters for linked login, enabled login, vessel access, and admin/hub access.
- Vessel readiness uses actual former login state from `/api/admin/crew/former-access-risks`.
- Onboarding separates login created, login skipped, and login missing.
- Onboarding no longer claims deployment readiness while documents/certificates are not assessed.
- Offboarding returns visible revocation results and can remove additional roles and downgrade primary role.
- Safety alarm clear notes are persisted on the alarm record and displayed in Alert Log.
- Safety alarm operation permissions are split from alarm type management permissions.

## Backend/API Changes

- Added `GET /api/admin/crew/former-access-risks`.
- `POST /api/crew/:id/retire` and `POST /api/crew/:id/cancel` now return `offboardingResult`.
- Offboarding inputs now support `removeAdditionalRoles` and `downgradePrimaryRole`.
- Added `resolution_note` to `vessel_safety_alarms`.
- `POST /api/admin/safety-alarms/:id/clear` persists `resolutionNote`.
- Safety routes now enforce:
  - `safety_alarms:view`
  - `safety_alarms:trigger`
  - `safety_alarms:clear`
  - `safety_alarms:export` for client-side export visibility
  - `safety_alarm_types:view`
  - `safety_alarm_types:manage`

## Known Limitations

- Document readiness remains explicitly `Not assessed`; a future pass should add a real document/certification aggregate endpoint.
- Alert readiness on roster rows remains `Not assessed`; a future pass should connect per-crew alert exposure/history when the data model supports it.
- Skip Login for Now is a UI onboarding choice for the current checklist flow; it is not persisted as a crew profile field.
- Typecheck could not run in this extracted workspace because `tsc` is not installed.


## Follow-up Patch Applied Here

- Vessel readiness now separates **Crew Assignment**, **Access Ready**, **Documents Not Assessed**, and **Deployment Pending** instead of marking every vessel permanently as simply `Not ready` because document readiness is not yet implemented.
- Temporary password and password-change states are displayed as user-pending warnings rather than access blockers in the vessel readiness panel.
- Offboarding revocation results are appended to the employment/termination notes so the access cleanup summary remains visible in crew history, not only in a temporary toast.
- User access saves now invalidate/refetch crew users, active access readiness, former access risks, and crew roster data on both success and partial failure.
- Alert Log now supports `Triggered by` and `Cleared by` text filters in addition to date, scope, severity, mode, and status.
- Profile and form grids were adjusted to collapse to one column on small screens.
