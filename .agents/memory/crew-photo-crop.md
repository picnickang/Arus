---
name: Crew profile photo crop format
description: Why CrewPhotoModal exports a square JPEG (not a circular PNG) and how avatars stay round.
---

CrewPhotoModal exports a **square 512px JPEG**, not a circular PNG.

**Why:** JPEG has no alpha channel, so baking a circular mask into the file leaves
black corners. The crop is kept square and the round look is applied with a CSS
circular clip on the avatar instead.

**How to apply:** any new crop/export path for profile imagery should output a
rectangular format and let the display layer clip to a circle — do not encode the
mask into a JPEG.
