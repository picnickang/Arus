import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VesselSectionDefinition, VesselSectionMapDefinition } from "./registry";

function pointsFor(
  section: VesselSectionDefinition,
  sectionMap: VesselSectionMapDefinition
): string {
  return section.polygonNormalized
    .map((point) => `${point.x * sectionMap.diagramWidth},${point.y * sectionMap.diagramHeight}`)
    .join(" ");
}

function sectionLabel(
  section: VesselSectionDefinition,
  sectionMap: VesselSectionMapDefinition
): { x: number; y: number } {
  return {
    x: section.labelNormalized.x * sectionMap.diagramWidth,
    y: section.labelNormalized.y * sectionMap.diagramHeight,
  };
}

interface SectionedVesselMapProps {
  sectionMap: VesselSectionMapDefinition;
  selectedSectionKey: string;
  baseImageUrl?: string;
  onSelectSection: (sectionKey: string) => void;
}

export function SectionedVesselMap({
  sectionMap,
  selectedSectionKey,
  baseImageUrl,
  onSelectSection,
}: SectionedVesselMapProps) {
  const selectedSection =
    sectionMap.sections.find((section) => section.sectionKey === selectedSectionKey) ??
    sectionMap.sections[0];

  return (
    <div className="space-y-4" data-testid="vessel-intelligence-section-map">
      <div className="rounded-md border bg-slate-950 p-3">
        <svg
          viewBox={`0 0 ${sectionMap.diagramWidth} ${sectionMap.diagramHeight}`}
          role="img"
          aria-label="Normalized vessel section map"
          className="h-auto w-full"
        >
          <defs>
            <linearGradient id="vi-hull-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#0f335b" />
              <stop offset="52%" stopColor="#0b4e73" />
              <stop offset="100%" stopColor="#12344d" />
            </linearGradient>
          </defs>
          {baseImageUrl ? (
            <image
              href={baseImageUrl}
              width={sectionMap.diagramWidth}
              height={sectionMap.diagramHeight}
              preserveAspectRatio="xMidYMid meet"
              opacity="0.74"
              data-testid="uploaded-schematic-base-layer"
            />
          ) : (
            <>
              <path
                d="M10 270 L65 220 L560 215 L650 120 L770 120 L830 215 L885 230 L850 360 L70 360 Z"
                fill="url(#vi-hull-gradient)"
                stroke="#71b7e8"
                strokeWidth="2"
                opacity="0.95"
              />
              <path
                d="M410 216 L520 138 L654 138 L654 216 Z"
                fill="#103f63"
                stroke="#71b7e8"
                strokeWidth="1.5"
                opacity="0.8"
              />
            </>
          )}
          {sectionMap.sections.map((section) => {
            const isSelected = section.sectionKey === selectedSection?.sectionKey;
            const label = sectionLabel(section, sectionMap);
            return (
              <g key={section.sectionKey}>
                <polygon
                  points={pointsFor(section, sectionMap)}
                  fill={section.color}
                  fillOpacity={isSelected ? 0.62 : 0.38}
                  stroke={isSelected ? "#ffffff" : section.color}
                  strokeWidth={isSelected ? 4 : 2}
                  data-testid={`section-polygon-${section.sectionKey}`}
                />
                <circle cx={label.x} cy={label.y} r={isSelected ? 15 : 11} fill="#04111f" />
                <text
                  x={label.x}
                  y={label.y + 5}
                  textAnchor="middle"
                  className="fill-white text-[15px] font-semibold"
                >
                  {section.sectionNo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" data-testid="section-selector-grid">
        {sectionMap.sections.map((section) => {
          const selected = section.sectionKey === selectedSection?.sectionKey;
          return (
            <Button
              key={section.sectionKey}
              type="button"
              variant={selected ? "default" : "outline"}
              className="h-auto justify-start gap-2 whitespace-normal px-3 py-2 text-left"
              onClick={() => onSelectSection(section.sectionKey)}
              data-testid={`section-button-${section.sectionKey}`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: section.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 text-xs leading-tight">
                <span className="block font-semibold">Section {section.sectionNo}</span>
                <span className="block text-muted-foreground">{section.name}</span>
              </span>
            </Button>
          );
        })}
      </div>

      {selectedSection && (
        <div className="rounded-md border p-4" data-testid="selected-section-detail">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{selectedSection.name}</h2>
              <p className="text-sm text-muted-foreground">
                Section {selectedSection.sectionNo} uses normalized map coordinates and can contain
                multiple equipment records.
              </p>
            </div>
            <Badge variant="outline">{selectedSection.equipment.length} registry items</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSection.equipment.map((equipmentName) => (
              <Badge key={equipmentName} variant="secondary">
                {equipmentName}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Thumbnail fallback: {selectedSection.thumbnailFallback}
          </p>
        </div>
      )}
    </div>
  );
}
