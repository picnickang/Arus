# Crew Management Readiness QA

Manual QA checklist for the Crew Management readiness, access, offboarding, safety, and mobile workflow update.

## Roster Data Consistency

1. Open `/crew-management` as a user with `crew_members:view`.
2. In Active Roster, apply each visible filter one at a time.
3. Confirm the visible row count, empty state, and exported CSV all match the same displayed rows.
4. Confirm no inactive-only filter appears in Active Roster.
5. Switch to Former Crew, sort by name and rank, and confirm the table order changes.
6. Export Former Crew and confirm the CSV contains only the visible former crew rows.
7. Confirm the Active Roster access-readiness filter is hidden in Former Crew.
8. In Former Crew, apply each access-risk filter and confirm rows are filtered by former access risk only.

## Access Readiness

1. Use admin access to open Active Roster.
2. Confirm each active crew row shows access readiness, vessel assignment/scope, login status, document readiness, and alert readiness indicators.
3. For crew without a login, disabled login, no password, temporary password issued, user password change required, missing vessel scope, missing dashboard, or fleet-wide scope review, confirm the badge text is understandable and the Fix Access action opens the profile access tab.
4. Confirm a view-only user can view roster rows but cannot add, edit, delete, offboard, toggle duty, or manage access.
5. Confirm temporary password issued is shown as user-pending, not an admin setup failure.

## Onboarding

1. Create a new crew member.
2. Confirm the onboarding readiness dialog opens after creation.
3. Confirm the checklist shows profile created, vessel assignment, role/rank, emergency contact, login/access, and document/certificate readiness.
4. Confirm Docs & Certs opens the profile documents tab.
5. Confirm Set Up Access opens the profile access tab when access readiness is enabled.
6. Confirm fleet-wide access review leaves the crew member in Not ready state until reviewed.
7. Confirm a crew member with `no_login` does not show login setup as complete.
8. Click Skip Login for Now and confirm the checklist shows skipped login separately from missing login.
9. Confirm the dialog shows Deployment Ready: No while documents/certificates are not assessed.

## Safe Offboarding

1. Retire an active crew member with a linked login.
2. Confirm the offboarding dialog defaults these actions on: disable login, remove vessel access, remove dashboard/admin access, remove additional roles, downgrade primary role, end duty status, preserve records.
3. Complete the action and confirm the crew member moves to Former Crew.
4. Confirm the success toast summarizes login disabled, vessel access removed, dashboard/admin access removed, additional roles removed, primary role downgraded, duty ended, and records preserved.
5. Confirm the linked login is disabled and active vessel/dashboard access is removed.
6. Repeat for Cancel Contract.
7. Reinstate the crew member and confirm high-risk access is not automatically restored.
8. Attempt hard delete and confirm the exact crew name is required before the destructive action is enabled.

## Former Crew Access Risk

1. Offboard a crew member with a disabled linked login and confirm Former Crew does not count them as active-login risk.
2. Manually re-enable a former crew linked login and confirm Former Crew flags them as active-login risk.
3. Leave vessel access on a former crew account and confirm the vessel-access-risk filter finds the row.
4. Leave admin/hub access on a former crew account and confirm the admin/hub-risk filter finds the row.

## Access Editor Save Results

1. Change role, vessel scope, login state, and hub/admin access for a crew-linked user.
2. Save and confirm the result panel lists role saved, vessel scope saved, login saved, and hub/admin access saved when applicable.
3. Simulate or force one API failure and confirm successful and failed steps are shown separately.
4. Confirm "No vessel access" and "Fleet-wide access (explicit)" are not conflated.

## Safety Alert Log

1. Open Crew Management > Safety as a permitted safety role.
2. Confirm Current Alarms only lists active alarms.
3. Confirm Alert Log lists active and cleared alarms with triggered time, cleared time, scope, severity, mode, status, triggered by, cleared by, and acknowledgement count.
4. Filter Alert Log by date range, vessel/scope, severity, mode, and status.
5. Expand an alert log row and confirm details, acknowledgement context, cleared by, cleared time, and resolution note are visible.
6. Trigger a critical real alarm and confirm clearing it requires a resolution note.
7. Confirm drill/test alarms are visually distinct from real alarms.
8. Export Alert Log and confirm the CSV contains the visible filtered rows.
9. Confirm a captain/chief engineer/fleet manager can view/trigger/clear only when granted `safety_alarms` permissions.
10. Confirm a captain cannot create/edit/delete alarm types without `safety_alarm_types:manage`.

## Vessel Readiness

1. Select a vessel filter in Active Roster.
2. Confirm the Vessel Readiness panel appears with assigned crew, on-duty crew, missing login, no vessel scope, unassigned active crew, and readiness status.
3. Confirm blockers list crew names and reasons.
4. Use a blocker Fix action and confirm it opens the relevant profile access workflow.

## Mobile

1. Open `/crew-management` at a phone-width viewport.
2. Confirm Active Roster renders cards instead of a horizontally scrolling table.
3. Confirm each card shows name, rank, vessel, duty, access readiness, document readiness, alert readiness, and primary action.
4. Open a profile and confirm profile grids collapse to one column.
