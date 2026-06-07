# Vessel Intelligence v2 Responsive Rules

- Use the desktop frames from tablet landscape upward.
- Use the mobile frames below tablet width, preserving section map access, equipment thumbnails, alert timelines, and maintenance actions.
- Keep the section map aspect ratio stable; overlays, labels, hover state, and selected section outlines must not resize the map.
- Mobile map interactions should support tap selection and vertical detail panels instead of requiring hover.
- Preserve route behavior across desktop and mobile; responsive changes are layout changes only.
- Offline/stale mobile state follows `mobile/10_mobile_offline_stale_data_state.svg` and should not show fabricated live numbers.
