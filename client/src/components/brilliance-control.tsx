import { useState } from "react";

import { ObcBrillianceMenu } from "@oicl/openbridge-webcomponents-react/components/brilliance-menu/brilliance-menu.js";
import type { ObcPaletteChangeEvent } from "@oicl/openbridge-webcomponents-react/components/brilliance-menu/brilliance-menu.js";
import { ObiDisplayBrillianceIec } from "@oicl/openbridge-webcomponents-react/icons/icon-display-brilliance-iec.js";
import { ObcPalette, ObcBrillianceMenuVariant } from "@oicl/openbridge-webcomponents/dist/components/brilliance-menu/brilliance-menu.js";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/components/theme-provider";

type Brilliance = "light" | "dark" | "bridge" | "daylight";

// ARUS's four brilliances are the OpenBridge palettes by another name.
const THEME_TO_PALETTE: Record<Brilliance, ObcPalette> = {
  light: ObcPalette.day,
  dark: ObcPalette.dusk,
  bridge: ObcPalette.night,
  daylight: ObcPalette.bright,
};
const PALETTE_TO_THEME: Record<ObcPalette, Brilliance> = {
  [ObcPalette.day]: "light",
  [ObcPalette.dusk]: "dark",
  [ObcPalette.night]: "bridge",
  [ObcPalette.bright]: "daylight",
};

/**
 * Brilliance / night-vision control built on the canonical OpenBridge
 * `obc-brilliance-menu` (configured palette-only — no brightness slider or
 * auto/link toggles ARUS can't honour). The popover trigger is a native button
 * (avoids Radix `asChild` × custom-element interop); the menu's palette buttons
 * map 1:1 to ARUS's four themes. IEC 62288 / OpenBridge aligned.
 */
export function BrillianceControl() {
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-grid h-11 w-11 place-items-center rounded-lg text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:w-9"
        aria-label="Display brilliance"
        title="Display brilliance"
        data-testid="brilliance-control"
      >
        <ObiDisplayBrillianceIec className="inline-block h-5 w-5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        data-testid="brilliance-menu-popover"
      >
        <ObcBrillianceMenu
          variant={ObcBrillianceMenuVariant.compact}
          showPalette
          showBrightness={false}
          palette={THEME_TO_PALETTE[resolvedTheme]}
          onPaletteChanged={(event: ObcPaletteChangeEvent) => {
            setTheme(PALETTE_TO_THEME[event.detail.value]);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
