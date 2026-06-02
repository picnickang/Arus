# Crew Management Gap Closure Hardening

This patch closes the remaining high-risk gaps identified in the role/dashboard + crew roster update.

## Closed gaps

1. **Former crew access-risk endpoint completed**
   - Added `listFormerCrewAccessRisks` to the crew-admin application service.
   - Former access-risk data now uses actual linked user state, not `userId` alone.
   - Risk states include linked login, login-enabled state, vessel/fleet assignments, hub/admin access, additional role assignments, and risk reasons.

2. **Former roster filtering hardened**
   - Active access-readiness filters remain active-roster only.
   - Former Crew now has separate access-risk filters: linked login, login still enabled, vessel access remains, hub/admin access remains, and high risk.

3. **Vessel readiness active-login detection fixed**
   - Former crew are only counted as active-login risks when the linked user account is actually active and login-enabled.

4. **Onboarding readiness wording corrected**
   - Login is no longer marked complete simply because an access object exists.
   - The checklist distinguishes login created, login missing, and future explicit login-skip state.
   - Deployment readiness remains pending while documents/certificates are not assessed.

5. **Access/password states clarified**
   - Added distinct readiness states for no password set, temporary password issued, and password change required.
   - Temporary passwords are treated as admin-complete/user-pending instead of setup failure.

6. **Offboarding feedback and cleanup strengthened**
   - Retire/cancel flows return offboarding results to the UI.
   - Admins see whether login, vessel access, hub/admin access, and role assignments were removed.
   - Offboarding clears vessel assignments, hub access, additional roles, and safely downgrades primary role where appropriate.

7. **Safety alert resolution notes persisted and displayed**
   - Added `resolution_note` to the safety alarm schema and migration.
   - Clear-alarm flow persists resolution notes and returns them in the alert DTO.
   - Alert Log can display resolution notes instead of relying only on audit logs.

8. **Safety permissions split**
   - Backend routes now use permission checks instead of broad role gates.
   - Alarm operation and alarm type configuration are separated:
     - `safety_alarms:view`
     - `safety_alarms:trigger`
     - `safety_alarms:clear`
     - `safety_alarms:acknowledge`
     - `safety_alarms:export`
     - `safety_alarm_types:view`
     - `safety_alarm_types:manage`
   - Permission registry now includes the new safety resources/actions.

9. **Partial access-save errors no longer close the editor**
   - `UserAccessEditor` keeps the dialog open when a multi-step save partially fails so the admin can see and fix failed steps.

10. **Visual semantics cleanup**
   - On-duty badges use normal operational styling, not destructive styling.
   - Blocking access/document/safety states remain visually stronger than routine states.

## Manual QA checklist

- Active roster count, displayed rows, and CSV export match.
- Former Crew sorting works.
- Former Crew export exports only visible former rows.
- Former Crew does not use active access-readiness filters.
- Former Crew access-risk filters work for linked login, login-enabled, vessel-access, hub-access, and high-risk states.
- Former crew with disabled login is not counted as active-login risk.
- Former crew with enabled login is counted as active-login risk.
- Onboarding checklist does not mark `no_login` complete.
- Deployment readiness is not shown as ready when documents are pending/not assessed.
- Temporary password issued is distinct from no password set.
- Retiring/cancelling crew displays offboarding revocation summary.
- Reinstating crew does not silently restore high-risk access.
- Clearing a serious real alarm requires a resolution note.
- Cleared alarms show the resolution note in Alert Log.
- Captains/fleet managers cannot manage alarm types unless granted `safety_alarm_types:manage`.
- Users without `safety_alarms:clear` cannot clear alarms.
- On Duty is not styled as destructive/red.

## Validation notes

A targeted TypeScript transpile/syntax pass was run over the modified files and passed. Full project `npm run check` could not complete in the sandbox because the uploaded extracted tree is missing dependency type packages such as `@types/node` and `vite`.
