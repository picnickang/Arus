export type MobileReadinessAssetKind =
  | "vessel-thumbnail"
  | "crew-avatar"
  | "work-photo"
  | "diagram"
  | "chart"
  | "icon";

export type MobileReadinessAssetStatus = "exported" | "recreated" | "fallback";

export interface MobileReadinessAsset {
  id: string;
  kind: MobileReadinessAssetKind;
  status: MobileReadinessAssetStatus;
  alt: string;
  src: string;
  figmaSource: string;
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function vesselSvg(name: string, hull: string, accent: string, sky = "#dff2ff"): string {
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 190">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${sky}"/>
          <stop offset="1" stop-color="#f8fbff"/>
        </linearGradient>
        <linearGradient id="sea" x1="0" x2="1">
          <stop offset="0" stop-color="#77bee8"/>
          <stop offset="1" stop-color="#a9daf5"/>
        </linearGradient>
      </defs>
      <rect width="320" height="190" rx="12" fill="url(#sky)"/>
      <rect y="128" width="320" height="62" fill="url(#sea)"/>
      <path d="M24 125h228l42 22-24 19H70c-18 0-34-10-46-41Z" fill="${hull}"/>
      <path d="M55 94h118l28 31H43l12-31Z" fill="#fff" stroke="#c9d6e4" stroke-width="3"/>
      <rect x="91" y="57" width="76" height="43" rx="4" fill="#fff" stroke="#c9d6e4" stroke-width="3"/>
      <rect x="111" y="32" width="31" height="28" rx="3" fill="#fff" stroke="#c9d6e4" stroke-width="3"/>
      <path d="M142 34l38-20 4 7-37 24Z" fill="#6b7a90"/>
      <circle cx="76" cy="109" r="5" fill="${accent}"/>
      <circle cx="105" cy="109" r="5" fill="${accent}"/>
      <circle cx="134" cy="109" r="5" fill="${accent}"/>
      <path d="M46 147c42 13 89 13 141 0 34-8 61-8 88 0" fill="none" stroke="#e8f7ff" stroke-width="4" opacity=".8"/>
      <text x="22" y="28" font-family="Arial" font-size="20" font-weight="700" fill="#092a55">${name}</text>
    </svg>
  `);
}

function avatarSvg(initials: string, skin: string, shirt: string): string {
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#f8fafc"/>
          <stop offset="1" stop-color="#dbe3ef"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#bg)"/>
      <path d="M15 91c5-24 20-37 33-37s28 13 33 37" fill="${shirt}"/>
      <path d="M35 58l13 12 13-12v20H35Z" fill="#f8fafc" opacity=".92"/>
      <rect x="39" y="48" width="18" height="17" rx="8" fill="${skin}"/>
      <ellipse cx="48" cy="35" rx="18" ry="21" fill="${skin}"/>
      <path d="M29 32c3-17 14-25 29-20 10 3 15 11 15 23-8-8-20-7-30-13-4 8-8 11-14 10Z" fill="#263241"/>
      <circle cx="33" cy="38" r="4" fill="${skin}"/>
      <circle cx="63" cy="38" r="4" fill="${skin}"/>
      <circle cx="41" cy="36" r="2.2" fill="#182335"/>
      <circle cx="55" cy="36" r="2.2" fill="#182335"/>
      <path d="M48 39l-3 9h6" fill="none" stroke="#9a6749" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M41 52c5 4 10 4 15 0" fill="none" stroke="#7c4a36" stroke-width="2" stroke-linecap="round"/>
      <path d="M27 91h42l-21-18Z" fill="#0b2d5b" opacity=".28"/>
      <circle cx="70" cy="74" r="11" fill="#03295a"/>
      <text x="70" y="79" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" fill="#fff">${initials}</text>
    </svg>
  `);
}

function workPhotoSvg(kind: "compressor" | "gauge" | "motor"): string {
  const body =
    kind === "gauge"
      ? '<circle cx="80" cy="58" r="34" fill="#f8fafc" stroke="#64748b" stroke-width="8"/><path d="M80 58l22-16" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/><text x="80" y="112" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="#0f172a">0.08</text>'
      : kind === "motor"
        ? '<rect x="30" y="45" width="100" height="48" rx="12" fill="#64748b"/><circle cx="40" cy="69" r="28" fill="#334155"/><circle cx="128" cy="69" r="24" fill="#94a3b8"/><path d="M38 102h80" stroke="#475569" stroke-width="12" stroke-linecap="round"/>'
        : '<rect x="22" y="42" width="116" height="50" rx="8" fill="#475569"/><path d="M35 54h90M35 68h90M35 82h90" stroke="#cbd5e1" stroke-width="5"/><circle cx="48" cy="106" r="14" fill="#334155"/><circle cx="112" cy="106" r="14" fill="#334155"/>';
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 128">
      <rect width="160" height="128" rx="12" fill="#e5e7eb"/>
      <rect x="10" y="14" width="140" height="100" rx="10" fill="#f8fafc"/>
      ${body}
    </svg>
  `);
}

const sideElevationSvg = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360">
    <defs>
      <linearGradient id="water" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#bfe8ff"/>
        <stop offset="1" stop-color="#e8f7ff"/>
      </linearGradient>
    </defs>
    <rect width="720" height="360" fill="#f8fbff"/>
    <rect y="218" width="720" height="142" fill="url(#water)"/>
    <path d="M56 191h530c38 0 63 14 78 39l-35 59H134C94 289 70 260 56 191Z" fill="#d5ecfb" stroke="#7aa7c9" stroke-width="5"/>
    <path d="M86 229h542l-29 50H144c-30 0-48-15-58-50Z" fill="#e9a5a5" opacity=".82" stroke="#b86b6b" stroke-width="3"/>
    <path d="M104 188V83h62V51h56v33h73v104" fill="#fff" stroke="#31455f" stroke-width="4"/>
    <path d="M180 86h250l96 72" fill="none" stroke="#9aa9bc" stroke-width="4"/>
    <path d="M212 72h88M220 98h66M124 116h42M124 142h70M124 168h92" stroke="#7b8da5" stroke-width="4"/>
    <path d="M310 193v94M420 193v94M530 193v94" stroke="#ffffff" stroke-width="3" opacity=".85"/>
    <rect x="300" y="217" width="142" height="70" rx="14" fill="#f97316" opacity=".38" stroke="#f97316" stroke-width="7"/>
    <path d="M327 252h92M337 239h72M337 265h72" stroke="#f97316" stroke-width="7" stroke-linecap="round"/>
  </svg>
`);

const riskChartSvg = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">
    <rect width="360" height="180" rx="12" fill="#fff"/>
    <path d="M28 148h304M28 112h304M28 76h304M28 40h304" stroke="#e5e7eb" stroke-width="2"/>
    <path d="M28 132C58 110 75 125 96 101C125 68 143 96 166 73C198 42 213 69 244 48C282 23 305 48 332 22" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
    <path d="M28 140C72 120 107 129 150 108C191 86 232 97 332 66" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round"/>
    <path d="M28 104C90 96 145 112 206 98C260 86 292 94 332 83" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
    <path d="M28 116h304" stroke="#f59e0b" stroke-dasharray="8 7" stroke-width="3"/>
    <path d="M28 58h304" stroke="#ef4444" stroke-dasharray="8 7" stroke-width="3"/>
  </svg>
`);

const readinessIconSvg = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="20" fill="#03295a"/>
    <circle cx="48" cy="48" r="30" fill="#f8fafc" opacity=".96"/>
    <path d="M31 52l11 11 24-32" fill="none" stroke="#16a34a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M48 10v12M48 74v12M10 48h12M74 48h12" stroke="#93c5fd" stroke-width="6" stroke-linecap="round"/>
  </svg>
`);

const fallbackSvg = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 128">
    <rect width="160" height="128" rx="12" fill="#e5e7eb"/>
    <path d="M28 88h104L108 48 88 70 74 56 52 88Z" fill="#94a3b8"/>
    <circle cx="53" cy="42" r="11" fill="#cbd5e1"/>
    <text x="80" y="112" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#475569">ARUS</text>
  </svg>
`);

export const mobileReadinessAssetInventory = [
  {
    id: "vessel-atlas",
    kind: "vessel-thumbnail",
    status: "recreated",
    alt: "MV Atlas at sea",
    src: vesselSvg("MV Atlas", "#1f2937", "#ef4444"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "vessel-borealis",
    kind: "vessel-thumbnail",
    status: "recreated",
    alt: "MV Borealis in port",
    src: vesselSvg("MV Borealis", "#111827", "#f59e0b", "#eef7ff"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "vessel-corvus",
    kind: "vessel-thumbnail",
    status: "recreated",
    alt: "MV Corvus at sea",
    src: vesselSvg("MV Corvus", "#1d4ed8", "#22c55e", "#edf7ff"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "avatar-alex",
    kind: "crew-avatar",
    status: "recreated",
    alt: "Alex Morgan profile avatar",
    src: avatarSvg("AM", "#d3a47b", "#0b2d5b"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "avatar-michael",
    kind: "crew-avatar",
    status: "recreated",
    alt: "Michael Johnson crew avatar",
    src: avatarSvg("MJ", "#c89163", "#0f766e"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "avatar-sarah",
    kind: "crew-avatar",
    status: "recreated",
    alt: "Sarah Chen crew avatar",
    src: avatarSvg("SC", "#d8a17a", "#7c3aed"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "avatar-daniel",
    kind: "crew-avatar",
    status: "recreated",
    alt: "Daniel Garcia crew avatar",
    src: avatarSvg("DG", "#b7794f", "#dc2626"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "work-compressor",
    kind: "work-photo",
    status: "recreated",
    alt: "Compressor work photo",
    src: workPhotoSvg("compressor"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "work-motor",
    kind: "work-photo",
    status: "recreated",
    alt: "Motor work photo",
    src: workPhotoSvg("motor"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "work-gauge",
    kind: "work-photo",
    status: "recreated",
    alt: "Gauge work photo",
    src: workPhotoSvg("gauge"),
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "diagram-side-elevation",
    kind: "diagram",
    status: "recreated",
    alt: "Vessel side elevation diagram",
    src: sideElevationSvg,
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "telemetry-risk-chart",
    kind: "chart",
    status: "recreated",
    alt: "Telemetry advanced graph",
    src: riskChartSvg,
    figmaSource: "Editable visual-match rebuild; original reference is a locked PNG.",
  },
  {
    id: "icon-readiness-check",
    kind: "icon",
    status: "recreated",
    alt: "Readiness check icon",
    src: readinessIconSvg,
    figmaSource: "Reference-specific icon recreated from editable vector primitives.",
  },
  {
    id: "fallback-generic",
    kind: "icon",
    status: "fallback",
    alt: "Generic ARUS fallback asset",
    src: fallbackSvg,
    figmaSource: "Internal fallback for stale or unavailable reference assets.",
  },
] as const satisfies readonly MobileReadinessAsset[];

export type MobileReadinessAssetId = (typeof mobileReadinessAssetInventory)[number]["id"];

const fallbackAsset = mobileReadinessAssetInventory.find((item) => item.id === "fallback-generic");

export function getMobileReadinessAsset(
  id: MobileReadinessAssetId | string | null | undefined
): MobileReadinessAsset {
  const asset = mobileReadinessAssetInventory.find((item) => item.id === id);
  if (asset) {
    return asset;
  }
  if (!fallbackAsset) {
    throw new Error("Mobile readiness fallback asset is missing");
  }
  return fallbackAsset;
}

export function listMobileReadinessAssets(): readonly MobileReadinessAsset[] {
  return mobileReadinessAssetInventory;
}
