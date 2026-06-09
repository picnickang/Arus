import { useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { equipmentNameFor, type EquipmentRecord } from "./data";
import { SideElevationFitControls } from "./SideElevationFitControls";
import { imageFrameForScale, normalizeImageTransform } from "./side-elevation-calibration";
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

function liveMatchForEquipmentName(
  equipmentName: string,
  vesselEquipment: EquipmentRecord[]
): EquipmentRecord | undefined {
  const target = equipmentName.toLowerCase();
  return vesselEquipment.find((item) => {
    const names = [
      equipmentNameFor(item),
      item.assetCode,
      item.tagNumber,
      item.id,
      item.equipmentId,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
    return names.includes(target);
  });
}

function sectionEquipmentItems(
  section: VesselSectionDefinition,
  vesselEquipment: EquipmentRecord[]
) {
  return section.equipment.map((equipmentName) => {
    const live = liveMatchForEquipmentName(equipmentName, vesselEquipment);
    return {
      equipmentName,
      live,
      equipmentId: live?.id ?? live?.equipmentId ?? live?.assetCode ?? null,
    };
  });
}

interface SectionedVesselMapProps {
  sectionMap: VesselSectionMapDefinition;
  selectedSectionKey: string;
  baseImageUrl?: string;
  vesselId?: string;
  mapId?: string;
  canEditImageTransform?: boolean;
  vesselEquipment?: EquipmentRecord[];
  manageAssignmentsHref?: string;
  onSelectSection: (sectionKey: string) => void;
}

interface VesselSectionOverlayProps {
  sectionMap: VesselSectionMapDefinition;
  selectedSectionKey?: string;
  baseImageUrl?: string;
  baseImageScaleX?: number;
  baseImageScaleY?: number;
  baseImageOffsetX?: number;
  baseImageOffsetY?: number;
  testId?: string;
  baseLayerTestId?: string;
  className?: string;
}

export function VesselSectionOverlay({
  sectionMap,
  selectedSectionKey,
  baseImageUrl,
  baseImageScaleX,
  baseImageScaleY,
  baseImageOffsetX,
  baseImageOffsetY,
  testId = "vessel-section-overlay",
  baseLayerTestId = "uploaded-schematic-base-layer",
  className = "h-auto w-full",
}: VesselSectionOverlayProps) {
  const gradientId = `vi-hull-gradient-${useId().replace(/:/g, "")}`;
  const selectedSection = selectedSectionKey
    ? sectionMap.sections.find((section) => section.sectionKey === selectedSectionKey)
    : undefined;
  const baseImageTransform = normalizeImageTransform({
    ...sectionMap.imageTransform,
    ...(baseImageScaleX !== undefined ? { scaleX: baseImageScaleX } : {}),
    ...(baseImageScaleY !== undefined ? { scaleY: baseImageScaleY } : {}),
    ...(baseImageOffsetX !== undefined ? { offsetX: baseImageOffsetX } : {}),
    ...(baseImageOffsetY !== undefined ? { offsetY: baseImageOffsetY } : {}),
  });
  const baseImageFrame = imageFrameForScale(
    sectionMap,
    baseImageTransform.scaleX,
    baseImageTransform.scaleY,
    baseImageTransform.offsetX,
    baseImageTransform.offsetY
  );

  return (
    <svg
      viewBox={`0 0 ${sectionMap.diagramWidth} ${sectionMap.diagramHeight}`}
      role="img"
      aria-label="Normalized vessel section map"
      className={className}
      data-testid={testId}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#0f335b" />
          <stop offset="52%" stopColor="#0b4e73" />
          <stop offset="100%" stopColor="#12344d" />
        </linearGradient>
      </defs>
      {baseImageUrl ? (
        <image
          href={baseImageUrl}
          x={baseImageFrame.x}
          y={baseImageFrame.y}
          width={baseImageFrame.width}
          height={baseImageFrame.height}
          preserveAspectRatio="xMidYMid meet"
          opacity="0.82"
          data-testid={baseLayerTestId}
        />
      ) : (
        <>
          <path
            d="M10 270 L65 220 L560 215 L650 120 L770 120 L830 215 L885 230 L850 360 L70 360 Z"
            fill={`url(#${gradientId})`}
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
              fillOpacity={isSelected ? 0.52 : 0.34}
              stroke={section.color}
              strokeWidth={isSelected ? 4 : 2.2}
              data-testid={`section-polygon-${section.sectionKey}`}
            />
            <circle
              cx={label.x}
              cy={label.y}
              r={isSelected ? 15 : 13}
              fill={section.color}
              fillOpacity="0.95"
              stroke="#d5e8ff"
              strokeWidth="1.4"
            />
            <text
              x={label.x}
              y={label.y + 5}
              textAnchor="middle"
              fill="#f8fbff"
              stroke="#06111f"
              strokeWidth="0.7"
              paintOrder="stroke"
              className="text-[15px] font-bold"
            >
              {section.sectionNo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SectionedVesselMap({
  sectionMap,
  selectedSectionKey,
  baseImageUrl,
  vesselId,
  mapId,
  canEditImageTransform = false,
  vesselEquipment = [],
  manageAssignmentsHref,
  onSelectSection,
}: SectionedVesselMapProps) {
  const savedImageTransform = normalizeImageTransform(sectionMap.imageTransform);
  const [baseImageScaleX, setBaseImageScaleX] = useState(savedImageTransform.scaleX);
  const [baseImageScaleY, setBaseImageScaleY] = useState(savedImageTransform.scaleY);
  const [baseImageOffsetX, setBaseImageOffsetX] = useState(savedImageTransform.offsetX);
  const [baseImageOffsetY, setBaseImageOffsetY] = useState(savedImageTransform.offsetY);
  const hasSections = sectionMap.sections.length > 0;
  const selectedSection =
    sectionMap.sections.find((section) => section.sectionKey === selectedSectionKey) ??
    sectionMap.sections[0];
  const currentImageTransform = normalizeImageTransform({
    scaleX: baseImageScaleX,
    scaleY: baseImageScaleY,
    offsetX: baseImageOffsetX,
    offsetY: baseImageOffsetY,
  });

  useEffect(() => {
    setBaseImageScaleX(savedImageTransform.scaleX);
    setBaseImageScaleY(savedImageTransform.scaleY);
    setBaseImageOffsetX(savedImageTransform.offsetX);
    setBaseImageOffsetY(savedImageTransform.offsetY);
  }, [
    savedImageTransform.scaleX,
    savedImageTransform.scaleY,
    savedImageTransform.offsetX,
    savedImageTransform.offsetY,
  ]);

  const resetBaseImageScale = () => {
    setBaseImageScaleX(1);
    setBaseImageScaleY(1);
    setBaseImageOffsetX(0);
    setBaseImageOffsetY(0);
  };

  return (
    <div className="space-y-4" data-testid="vessel-intelligence-section-map">
      <div className="rounded-md border bg-slate-950 p-3">
        <VesselSectionOverlay
          sectionMap={sectionMap}
          selectedSectionKey={selectedSectionKey}
          baseImageUrl={baseImageUrl}
          baseImageScaleX={baseImageScaleX}
          baseImageScaleY={baseImageScaleY}
          baseImageOffsetX={baseImageOffsetX}
          baseImageOffsetY={baseImageOffsetY}
        />
      </div>

      {baseImageUrl && (
        <SideElevationFitControls
          vesselId={vesselId}
          mapId={mapId}
          canEditImageTransform={canEditImageTransform}
          currentImageTransform={currentImageTransform}
          savedImageTransform={savedImageTransform}
          onScaleXChange={setBaseImageScaleX}
          onScaleYChange={setBaseImageScaleY}
          onOffsetXChange={setBaseImageOffsetX}
          onOffsetYChange={setBaseImageOffsetY}
          onReset={resetBaseImageScale}
        />
      )}

      {hasSections ? (
        <div
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
          data-testid="section-selector-grid"
        >
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
      ) : (
        <div
          className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          data-testid="section-map-empty-sections"
        >
          No sections yet. Draw or add your first section.
        </div>
      )}

      {selectedSection && (
        <div className="rounded-md border p-4" data-testid="selected-section-detail">
          {(() => {
            const equipmentItems = sectionEquipmentItems(selectedSection, vesselEquipment);
            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{selectedSection.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      Section {selectedSection.sectionNo} uses normalized map coordinates and can
                      contain multiple equipment records.
                    </p>
                  </div>
                  <Badge variant="outline">{equipmentItems.length} registry items</Badge>
                </div>
                {equipmentItems.length === 0 ? (
                  <div
                    className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                    data-testid="section-equipment-empty"
                  >
                    No equipment assigned to this section.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2" data-testid="section-equipment-list">
                    {equipmentItems.map((item) => (
                      <div
                        key={item.equipmentName}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{item.equipmentName}</span>
                        <Badge
                          variant={item.live ? "default" : "secondary"}
                          data-testid={
                            item.live ? "section-equipment-live" : "section-equipment-registry-only"
                          }
                        >
                          {item.live ? "Live equipment" : "Registry only"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {manageAssignmentsHref && (
                  <Button className="mt-3" variant="outline" size="sm" asChild>
                    <Link
                      href={manageAssignmentsHref}
                      data-testid="button-manage-section-assignments"
                    >
                      Manage assignments
                    </Link>
                  </Button>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Thumbnail fallback: {selectedSection.thumbnailFallback}
                </p>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
