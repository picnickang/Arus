/** Section map editor: draw/select sections on the vessel map, edit section
 * metadata and polygons, and manage equipment assignments. Extracted verbatim
 * from the pre-split registry-screens.tsx. */

import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SectionedVesselMap } from "../SectionedVesselMap";
import { type VesselSectionMapDefinition } from "../registry";
import {
  equipmentNameFor,
  statusText,
  type EquipmentRecord,
  type RegistrySectionMapRecord,
  type RegistrySectionRecord,
} from "../data";
import {
  equipmentIdForThumbnail,
  useAddSection,
  useAssignEquipmentToSection,
  useRemoveEquipmentAssignment,
  useSectionMap,
  useUpdateSection,
  useValidateSectionMap,
} from "../registry-api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedInline,
  type PermissionSet,
} from "./shared";

export function SectionMapEditorEntry({
  vesselId,
  mapId,
  equipment,
  permissions,
}: {
  vesselId: string;
  mapId: string;
  equipment: EquipmentRecord[];
  permissions: PermissionSet;
}) {
  const mapQuery = useSectionMap(vesselId, mapId);
  const addSection = useAddSection();
  const updateSection = useUpdateSection();
  const assignEquipment = useAssignEquipmentToSection();
  const removeEquipment = useRemoveEquipmentAssignment();
  const validate = useValidateSectionMap();
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionKey, setSectionKey] = useState("");
  const [sectionColor, setSectionColor] = useState("#38bdf8");
  const [polygonText, setPolygonText] = useState(defaultPolygonText());
  const [labelX, setLabelX] = useState("0.5");
  const [labelY, setLabelY] = useState("0.5");
  const [equipmentId, setEquipmentId] = useState("");
  const [manualEquipmentName, setManualEquipmentName] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const map = mapQuery.data;
  const selectedSection = map?.sections.find((section) => section.id === selectedSectionId);
  const equipmentOptions = equipment
    .map((item) => ({ item, id: equipmentIdForThumbnail(item) }))
    .filter((option): option is { item: EquipmentRecord; id: string } => Boolean(option.id));

  const loadSection = (section: RegistrySectionRecord) => {
    setSelectedSectionId(section.id);
    setSectionName(section.name);
    setSectionKey(section.sectionKey);
    setSectionColor(section.color);
    setPolygonText(JSON.stringify(section.polygonNormalized, null, 2));
    setLabelX(String(section.labelNormalized.x));
    setLabelY(String(section.labelNormalized.y));
  };

  const saveSection = async () => {
    if (!map) {
      return;
    }
    const polygon = parsePolygon(polygonText);
    if (!polygon) {
      toast({
        title: "Section save failed",
        description: "Polygon must be valid normalized JSON.",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      sectionKey: sectionKey || `section_${(map.sections.length ?? 0) + 1}`,
      sectionNo: selectedSection?.sectionNo ?? map.sections.length + 1,
      name: sectionName || "New Section",
      color: sectionColor || "#38bdf8",
      polygonNormalized: polygon,
      labelNormalized: { x: Number(labelX), y: Number(labelY) },
    };
    if (selectedSection) {
      await updateSection.mutateAsync({ vesselId, mapId, sectionId: selectedSection.id, payload });
    } else {
      await addSection.mutateAsync({ vesselId, mapId, payload });
    }
    setSelectedSectionId("");
  };

  const assign = () => {
    if (!selectedSection) {
      return;
    }
    const selectedEquipment = equipmentOptions.find((option) => option.id === equipmentId)?.item;
    const equipmentName = selectedEquipment
      ? equipmentNameFor(selectedEquipment)
      : manualEquipmentName;
    if (!equipmentName) {
      return;
    }
    assignEquipment.mutate({
      vesselId,
      mapId,
      sectionId: selectedSection.id,
      payload: {
        equipmentId: selectedEquipment?.id,
        equipmentName,
        assetCode: selectedEquipment?.assetCode,
        system: selectedEquipment?.system,
      },
    });
  };

  const sectionMapDefinition = map ? sectionMapDefinitionFromRecord(map) : null;
  const baseImageUrl =
    map?.diagramId && map.diagramVersionId
      ? `/api/vessel-intelligence/${vesselId}/diagrams/${map.diagramId}/versions/${map.diagramVersionId}/media`
      : undefined;

  return (
    <section className="space-y-4">
      {mapQuery.isLoading && <LoadingState message="Loading section map." />}
      {mapQuery.isError && <ErrorState message="Section map could not be loaded." />}
      {map && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="rounded-md border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-semibold tracking-normal">{map.name}</h1>
                  <p className="text-sm text-muted-foreground">{statusText(map.status)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => validate.mutate({ vesselId, mapId })}
                  disabled={!permissions.canEditMap || validate.isPending}
                  data-testid="button-validate-map"
                >
                  {validate.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Validate
                </Button>
              </div>
              {sectionMapDefinition && map.sections.length > 0 ? (
                <SectionedVesselMap
                  sectionMap={sectionMapDefinition}
                  selectedSectionKey={
                    selectedSection?.sectionKey ?? map.sections[0]?.sectionKey ?? ""
                  }
                  baseImageUrl={baseImageUrl}
                  vesselId={vesselId}
                  mapId={mapId}
                  canEditImageTransform={permissions.canEditMap}
                  vesselEquipment={equipment}
                  manageAssignmentsHref={`/vessel-intelligence/${vesselId}/section-maps/${mapId}/edit`}
                  onSelectSection={(sectionKey) => {
                    const next = map.sections.find((section) => section.sectionKey === sectionKey);
                    if (next) {
                      loadSection(next);
                    }
                  }}
                />
              ) : (
                <EmptyState message="No sections yet. Draw or add your first section." />
              )}
            </div>

            <div className="space-y-3 rounded-md border p-4">
              {!permissions.canEditMap && (
                <PermissionDeniedInline message="You can view this map, but you do not have permission to edit section maps." />
              )}
              <div className="grid gap-2">
                <Label>Section</Label>
                <Select
                  value={selectedSectionId}
                  onValueChange={(id) => {
                    const next = map.sections.find((section) => section.id === id);
                    if (next) {
                      loadSection(next);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Create new section" />
                  </SelectTrigger>
                  <SelectContent>
                    {map.sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="section-name">Name</Label>
                <Input
                  id="section-name"
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                  placeholder="New Section"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="section-key">Key</Label>
                  <Input
                    id="section-key"
                    value={sectionKey}
                    onChange={(event) => setSectionKey(event.target.value)}
                    placeholder="new_section"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="section-color">Color</Label>
                  <Input
                    id="section-color"
                    type="color"
                    value={sectionColor}
                    onChange={(event) => setSectionColor(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="label-x">Label X</Label>
                  <Input
                    id="label-x"
                    value={labelX}
                    onChange={(event) => setLabelX(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="label-y">Label Y</Label>
                  <Input
                    id="label-y"
                    value={labelY}
                    onChange={(event) => setLabelY(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="section-polygon">Polygon points</Label>
                <Textarea
                  id="section-polygon"
                  rows={6}
                  value={polygonText}
                  onChange={(event) => setPolygonText(event.target.value)}
                />
              </div>
              <Button
                onClick={() => void saveSection()}
                disabled={
                  !permissions.canEditMap || addSection.isPending || updateSection.isPending
                }
              >
                <Save className="mr-2 h-4 w-4" />
                Save draft
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <h2 className="text-base font-semibold">Equipment Assignments</h2>
              {selectedSection ? (
                <div className="mt-3 space-y-3">
                  {selectedSection.equipment.length === 0 && (
                    <EmptyState message="No equipment assigned to this section." />
                  )}
                  {selectedSection.equipment.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <span>{assignment.equipmentName}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          assignment.id &&
                          removeEquipment.mutate({
                            vesselId,
                            mapId,
                            sectionId: selectedSection.id,
                            assignmentId: assignment.id,
                          })
                        }
                        disabled={!permissions.canAssignEquipment}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ))}
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Select value={equipmentId} onValueChange={setEquipmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipmentOptions.map(({ item, id }) => (
                          <SelectItem key={id} value={id}>
                            {equipmentNameFor(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={manualEquipmentName}
                      onChange={(event) => setManualEquipmentName(event.target.value)}
                      placeholder="Manual equipment name"
                    />
                    <Button
                      onClick={assign}
                      disabled={!permissions.canAssignEquipment || assignEquipment.isPending}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState message="Select a section to manage equipment assignments." />
              )}
            </div>
            <div className="rounded-md border p-4">
              <h2 className="text-base font-semibold">Thumbnail Controls</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {
                  "Fallback chain: manual upload -> crop from active schematic -> generated placeholder -> generic icon."
                }
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setLocation(`/vessel-intelligence/${vesselId}/thumbnails`)}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Open thumbnail manager
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function sectionMapDefinitionFromRecord(map: RegistrySectionMapRecord): VesselSectionMapDefinition {
  return {
    coordinateMode: "normalized_percent",
    diagramWidth: map.diagramWidth,
    diagramHeight: map.diagramHeight,
    diagramKind: map.diagramKind as VesselSectionMapDefinition["diagramKind"],
    imageTransform: map.imageTransform ?? undefined,
    sections: map.sections.map((section) => ({
      sectionNo: section.sectionNo,
      sectionKey: section.sectionKey,
      name: section.name,
      color: section.color,
      polygonNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
      equipment: section.equipment.map((assignment) => assignment.equipmentName),
      thumbnailFallback:
        section.thumbnailFallback ??
        "manual upload -> crop from active schematic -> generated placeholder -> generic icon",
    })),
  };
}

function parsePolygon(value: string) {
  try {
    const parsed = JSON.parse(value) as Array<{ x: number; y: number }>;
    if (!Array.isArray(parsed) || parsed.length < 3) {
      return null;
    }
    if (parsed.some((point) => typeof point.x !== "number" || typeof point.y !== "number")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function defaultPolygonText() {
  return JSON.stringify(
    [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.3, y: 0.3 },
      { x: 0.1, y: 0.3 },
    ],
    null,
    2
  );
}
