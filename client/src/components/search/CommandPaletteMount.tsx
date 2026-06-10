import { Suspense, lazy } from "react";

const GlobalCommandPalette = lazy(() => import("./GlobalCommandPalette"));

/** Lazy mount for the global palette — keeps the cmdk chunk out of the
 * initial bundle and the wiring out of App.tsx. */
export function CommandPaletteMount() {
  return (
    <Suspense fallback={null}>
      <GlobalCommandPalette />
    </Suspense>
  );
}
