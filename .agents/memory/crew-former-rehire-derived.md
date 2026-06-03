---
name: Crew former-rehire status is derived
description: Why the former-crew rehire badge is computed, not stored
---

# Former-crew rehire status is derived, not a real field

The former-crew archive shows a rehire badge, but there is **no**
rehire-eligibility column anywhere in the crew / employment-history data. The
status is computed from the most-recent employment period's termination type and
contract penalty.

**Why:** the redesign needed rehire badges, but the only honest signals available
are termination reason + penalty. Deriving avoids fabricating a stored field.

**How to apply:** if a real, editable rehire-eligibility field is later added,
read it first and keep the derivation only as the fallback for unset records — do
not delete the derivation.
