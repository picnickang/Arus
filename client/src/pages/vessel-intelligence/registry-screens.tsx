import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Archive,
  ArrowLeft,
  CheckCircle,
  Eye,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/hooks/use-toast";
import { SectionedVesselMap } from "./SectionedVesselMap";
import { type VesselSectionMapDefinition } from "./registry";
import {
  equipmentNameFor,
  statusText,
  vesselNameFor,
  type EquipmentRecord,
  type RegistrySectionMapRecord,
  type RegistrySectionRecord,
  type VesselRecord,
} from "./data";
import {
  equipmentIdForThumbnail,
  type RegistryDiagramVersionRecord,
  useAddSection,
  useArchiveDiagramVersion,
  useAssignEquipmentToSection,
  useDeleteEquipmentThumbnail,
  useDeleteSectionThumbnail,
  useDiagramDetail,
  useDiagramVersions,
  usePublishDiagramVersion,
  usePublishSectionMap,
  useRemoveEquipmentAssignment,
  useRestoreDiagramVersion,
  useSectionMap,
  useSectionMaps,
  useUpdateSection,
  useUploadEquipmentThumbnail,
  useUploadSectionThumbnail,
  useValidateSectionMap,
} from "./registry-api";
import { DiagramDetailPage } from "./registry-screens/DiagramDetailPage";
import { DiagramManager } from "./registry-screens/DiagramManager";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  PermissionDeniedInline,
  type PermissionSet,
} from "./registry-screens/shared";

interface RegistryRouteScreenProps {
  vesselId: string;
  diagramId?: string;
  mapId?: string;
  selectedVessel?: VesselRecord;
  equipment: EquipmentRecord[];
}

export function isRegistryRoute(location: string) {
  return (
    location.includes("/diagrams") ||
    location.includes("/section-maps/") ||
    location.includes("/thumbnails")
  );
}

export function RegistryRouteScreen({
  vesselId,
  diagramId,
  mapId,
  selectedVessel,
  equipment,
}: RegistryRouteScreenProps) {
  const [location] = useLocation();
  const permissions = useRegistryPermissions();

  let content = (
    <DiagramManager
      vesselId={vesselId}
      vesselName={vesselNameFor(selectedVessel)}
      permissions={permissions}
    />
  );

  if (location.includes("/diagrams/") && location.endsWith("/versions") && diagramId) {
    content = (
      <DiagramVersionHistory vesselId={vesselId} diagramId={diagramId} permissions={permissions} />
    );
  } else if (location.includes("/diagrams/") && diagramId) {
    content = (
      <DiagramDetailPage vesselId={vesselId} diagramId={diagramId} permissions={permissions} />
    );
  } else if (location.includes("/section-maps/") && location.endsWith("/edit") && mapId) {
    content = (
      <SectionMapEditorEntry
        vesselId={vesselId}
        mapId={mapId}
        equipment={equipment}
        permissions={permissions}
      />
    );
  } else if (location.includes("/section-maps/") && location.endsWith("/validate") && mapId) {
    content = (
      <PublishValidationPanel vesselId={vesselId} mapId={mapId} permissions={permissions} />
    );
  } else if (location.includes("/thumbnails")) {
    content = (
      <ThumbnailManager vesselId={vesselId} equipment={equipment} permissions={permissions} />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4" data-testid="vessel-intelligence-registry-route">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="secondary">{vesselNameFor(selectedVessel)}</Badge>
          <h2 className="mt-2 text-lg font-semibold text-slate-50">Diagram Registry Workspace</h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/vessel-intelligence/${vesselId}/overview`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to hub
          </Link>
        </Button>
      </div>
      {content}
    </div>
  );
}

export function DiagramVersionHistory({
  vesselId,
  diagramId,
  permissions,
}: {
  vesselId: string;
  diagramId: string;
  permissions: PermissionSet;
}) {
  const diagramQuery = useDiagramDetail(vesselId, diagramId);
  const versionsQuery = useDiagramVersions(vesselId, diagramId);
  const publish = usePublishDiagramVersion();
  const archive = useArchiveDiagramVersion();
  const restore = useRestoreDiagramVersion();
  const versions = versionsQuery.data ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-md border p-4">
        <h1 className="text-xl font-semibold tracking-normal">Version History</h1>
        <p className="text-sm text-muted-foreground">{diagramQuery.data?.title ?? diagramId}</p>
      </div>
      {versionsQuery.isLoading && <LoadingState message="Loading versions." />}
      {versionsQuery.isError && <ErrorState message="Versions could not be loaded." />}
      {versions.length === 0 && !versionsQuery.isLoading ? (
        <EmptyState message="This diagram has no active version. Upload and publish a version." />
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              canRollback={permissions.canRollbackDiagram}
              publishing={publish.isPending}
              archiving={archive.isPending}
              restoring={restore.isPending}
              onPublish={() => publish.mutate({ vesselId, diagramId, versionId: version.id })}
              onArchive={() => archive.mutate({ vesselId, diagramId, versionId: version.id })}
              onRestore={() => restore.mutate({ vesselId, diagramId, versionId: version.id })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VersionRow({
  version,
  canRollback,
  publishing,
  archiving,
  restoring,
  onPublish,
  onArchive,
  onRestore,
}: {
  version: RegistryDiagramVersionRecord;
  canRollback: boolean;
  publishing: boolean;
  archiving: boolean;
  restoring: boolean;
  onPublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">v{version.versionNumber}</span>
          <Badge variant={version.status === "active" ? "default" : "outline"}>
            {statusText(version.status)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {version.originalFileName} | uploaded by {version.uploadedBy ?? "unknown"} |{" "}
          {formatDate(version.uploadedAt)}
        </p>
        <p className="text-xs text-muted-foreground">
          published by {version.publishedBy ?? "not published"} | {formatDate(version.publishedAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {version.mediaUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={version.mediaUrl} target="_blank" rel="noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </a>
          </Button>
        )}
        <ActionButton
          icon={CheckCircle}
          label="Publish"
          allowed={canRollback && version.status !== "active"}
          reason="Requires vessel-intelligence:rollback-diagram"
          loading={publishing}
          onClick={onPublish}
        />
        <ActionButton
          icon={Archive}
          label="Archive"
          allowed={canRollback && version.status !== "archived"}
          reason="Requires vessel-intelligence:rollback-diagram"
          loading={archiving}
          onClick={onArchive}
        />
        <ActionButton
          icon={RotateCcw}
          label="Restore as draft"
          allowed={canRollback}
          reason="Requires vessel-intelligence:rollback-diagram"
          loading={restoring}
          onClick={onRestore}
        />
      </div>
    </div>
  );
}

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

export function PublishValidationPanel({
  vesselId,
  mapId,
  permissions,
}: {
  vesselId: string;
  mapId: string;
  permissions: PermissionSet;
}) {
  const mapQuery = useSectionMap(vesselId, mapId);
  const validate = useValidateSectionMap();
  const publish = usePublishSectionMap();
  const [, setLocation] = useLocation();
  const validation = validate.data;
  const blockers = validation?.issues.filter((issue) => issue.severity === "blocker") ?? [];
  const warnings = validation?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const canPublish = permissions.canPublishMap && Boolean(validation) && blockers.length === 0;

  return (
    <section className="space-y-4">
      <div className="rounded-md border p-4">
        <h1 className="text-xl font-semibold tracking-normal">Validate Section Map</h1>
        <p className="text-sm text-muted-foreground">{mapQuery.data?.name ?? mapId}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => validate.mutate({ vesselId, mapId })}
          disabled={!permissions.canEditMap || validate.isPending}
        >
          {validate.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Run validation
        </Button>
        <Button
          data-testid="button-publish-map"
          onClick={() => publish.mutate({ vesselId, mapId })}
          disabled={!canPublish || publish.isPending}
          title={
            permissions.canPublishMap ? "Publish map" : "Requires vessel-intelligence:publish-map"
          }
        >
          {publish.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Publish map
        </Button>
        <Button
          variant="outline"
          onClick={() => setLocation(`/vessel-intelligence/${vesselId}/section-maps/${mapId}/edit`)}
        >
          Back to editor
        </Button>
      </div>
      {!permissions.canPublishMap && (
        <PermissionDeniedInline message="You can validate this map, but you do not have permission to publish maps. Requires vessel-intelligence:publish-map." />
      )}
      {!validation ? (
        <EmptyState message="Run validation to see blockers, warnings, and passed checks." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <ValidationColumn
            title="Blockers"
            issues={blockers}
            empty="No blockers found."
            variant="destructive"
          />
          <ValidationColumn
            title="Warnings"
            issues={warnings}
            empty="No warnings found."
            variant="warning"
          />
          <ValidationColumn
            title="Passed checks"
            issues={[
              {
                code: "sections_loaded",
                message: `${mapQuery.data?.sections.length ?? 0} sections loaded`,
              },
              { code: "validation_complete", message: validation.summary.checkedAt },
            ]}
            empty="No passed checks."
            variant="success"
          />
        </div>
      )}
    </section>
  );
}

export function ThumbnailManager({
  vesselId,
  equipment,
  permissions,
}: {
  vesselId: string;
  equipment: EquipmentRecord[];
  permissions: PermissionSet;
}) {
  const mapsQuery = useSectionMaps(vesselId);
  const uploadSection = useUploadSectionThumbnail();
  const uploadEquipment = useUploadEquipmentThumbnail();
  const deleteSection = useDeleteSectionThumbnail();
  const deleteEquipment = useDeleteEquipmentThumbnail();
  const sections = (mapsQuery.data ?? []).flatMap((map) => map.sections);

  return (
    <section className="space-y-4" data-testid="thumbnail-manager">
      <div className="rounded-md border p-4">
        <h1 className="text-xl font-semibold tracking-normal">Thumbnail Management</h1>
        <p className="text-sm text-muted-foreground">
          {
            "Fallback chain: manual upload -> crop from active schematic -> generated placeholder -> generic icon."
          }
        </p>
      </div>
      {sections.length === 0 && (
        <EmptyState message="No thumbnails yet. The fallback chain will use generated placeholders until sections or equipment have overrides." />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Section thumbnails</h2>
          {sections.map((section) => (
            <SectionThumbnailCard
              key={section.id}
              vesselId={vesselId}
              section={section}
              canReplace={permissions.canReplaceSectionThumbnail}
              uploading={uploadSection.isPending}
              deleting={deleteSection.isPending}
              onUpload={(file) => uploadSection.mutate({ vesselId, sectionId: section.id, file })}
              onDelete={() => deleteSection.mutate({ vesselId, sectionId: section.id })}
            />
          ))}
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Equipment thumbnails</h2>
          {equipment.length === 0 && (
            <EmptyState message="No equipment assigned to this section." />
          )}
          {equipment.map((item) => {
            const equipmentId = equipmentIdForThumbnail(item);
            if (!equipmentId) {
              return (
                <div
                  key={equipmentNameFor(item)}
                  className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                >
                  {equipmentNameFor(item)} cannot use thumbnail actions until it has an equipment
                  ID, asset code, or name.
                </div>
              );
            }
            return (
              <EquipmentThumbnailCard
                key={equipmentId}
                vesselId={vesselId}
                equipment={item}
                equipmentId={equipmentId}
                canReplace={permissions.canReplaceEquipmentThumbnail}
                uploading={uploadEquipment.isPending}
                deleting={deleteEquipment.isPending}
                onUpload={(file) => uploadEquipment.mutate({ vesselId, equipmentId, file })}
                onDelete={() => deleteEquipment.mutate({ vesselId, equipmentId })}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SectionThumbnailCard({
  section,
  canReplace,
  uploading,
  deleting,
  onUpload,
  onDelete,
}: {
  vesselId: string;
  section: RegistrySectionRecord;
  canReplace: boolean;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <ThumbnailCard
      title={section.name}
      color={section.color}
      fallback={
        section.thumbnailFallback ??
        "manual upload -> crop from active schematic -> generated placeholder -> generic icon"
      }
      canReplace={canReplace}
      permissionReason="Requires vessel-intelligence:replace-section-thumbnail"
      uploading={uploading}
      deleting={deleting}
      uploadTestId="section-thumbnail-upload"
      onUpload={onUpload}
      onDelete={onDelete}
    />
  );
}

export function EquipmentThumbnailCard({
  equipment,
  equipmentId,
  canReplace,
  uploading,
  deleting,
  onUpload,
  onDelete,
}: {
  vesselId: string;
  equipment: EquipmentRecord;
  equipmentId: string;
  canReplace: boolean;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <ThumbnailCard
      title={equipmentNameFor(equipment)}
      color="#64748b"
      fallback="manual upload -> section crop -> generated placeholder -> equipment icon"
      canReplace={canReplace && Boolean(equipmentId)}
      permissionReason={
        equipmentId
          ? "Requires vessel-intelligence:replace-equipment-thumbnail"
          : "Equipment has no stable ID"
      }
      uploading={uploading}
      deleting={deleting}
      uploadTestId="equipment-thumbnail-upload"
      onUpload={onUpload}
      onDelete={onDelete}
    />
  );
}

function ThumbnailCard({
  title,
  color,
  fallback,
  canReplace,
  permissionReason,
  uploading,
  deleting,
  uploadTestId,
  onUpload,
  onDelete,
}: {
  title: string;
  color: string;
  fallback: string;
  canReplace: boolean;
  permissionReason: string;
  uploading: boolean;
  deleting: boolean;
  uploadTestId: string;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex gap-3">
        <div
          className="grid h-16 w-20 shrink-0 place-items-center rounded-md border text-xs font-medium"
          style={{ backgroundColor: color }}
        >
          Preview
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Current thumbnail: manual override if present, otherwise fallback.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Fallback source: {fallback}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp"
          data-testid={uploadTestId}
          disabled={!canReplace || uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              onUpload(file);
            }
          }}
        />
        <Button variant="outline" size="sm" onClick={onDelete} disabled={!canReplace || deleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete override
        </Button>
      </div>
      {!canReplace && <p className="mt-2 text-xs text-muted-foreground">{permissionReason}</p>}
    </div>
  );
}

function useRegistryPermissions(): PermissionSet {
  const { hasAnyPermission } = usePermissions();
  return {
    canConfigure: hasAnyPermission("vessel-intelligence", ["configure"]),
    canUploadDiagram: hasAnyPermission("vessel-intelligence", ["upload-diagram"]),
    canRollbackDiagram: hasAnyPermission("vessel-intelligence", ["rollback-diagram"]),
    canEditMap: hasAnyPermission("vessel-intelligence", ["edit-section-map"]),
    canPublishMap: hasAnyPermission("vessel-intelligence", ["publish-map"]),
    canReplaceSectionThumbnail: hasAnyPermission("vessel-intelligence", [
      "replace-section-thumbnail",
    ]),
    canReplaceEquipmentThumbnail: hasAnyPermission("vessel-intelligence", [
      "replace-equipment-thumbnail",
    ]),
    canAssignEquipment: hasAnyPermission("vessel-intelligence", ["assign-equipment"]),
  };
}

function ValidationColumn({
  title,
  issues,
  empty,
  variant,
}: {
  title: string;
  issues: Array<{ code: string; message: string }>;
  empty: string;
  variant: "destructive" | "warning" | "success";
}) {
  const border =
    variant === "destructive"
      ? "border-red-500/50"
      : variant === "warning"
        ? "border-amber-500/50"
        : "border-emerald-500/50";
  return (
    <div className={`rounded-md border p-4 ${border}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {issues.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {issues.map((issue) => (
            <div
              key={`${title}-${issue.code}-${issue.message}`}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <p className="font-medium">{issue.code}</p>
              <p className="text-muted-foreground">{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
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
