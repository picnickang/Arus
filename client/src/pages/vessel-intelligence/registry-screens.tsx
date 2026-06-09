import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Archive,
  ArrowLeft,
  CheckCircle,
  Eye,
  History,
  ImagePlus,
  Loader2,
  Map,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  DIAGRAM_TYPES,
  type DiagramTypeDefinition,
  type VesselSectionMapDefinition,
} from "./registry";
import {
  equipmentNameFor,
  statusText,
  vesselNameFor,
  type EquipmentRecord,
  type RegistryDiagramRecord,
  type RegistrySectionMapRecord,
  type RegistrySectionRecord,
  type VesselRecord,
} from "./data";
import {
  equipmentIdForThumbnail,
  type RegistryDiagramVersionRecord,
  type ReplacementBehavior,
  useAddSection,
  useArchiveDiagramVersion,
  useAssignEquipmentToSection,
  useCreateDiagram,
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
  useSectionMapTemplates,
  useUpdateSection,
  useUploadDiagramVersion,
  useUploadEquipmentThumbnail,
  useUploadSectionThumbnail,
  useValidateSectionMap,
  useVesselDiagrams,
} from "./registry-api";

interface RegistryRouteScreenProps {
  vesselId: string;
  diagramId?: string;
  mapId?: string;
  selectedVessel?: VesselRecord;
  equipment: EquipmentRecord[];
}

interface PermissionSet {
  canConfigure: boolean;
  canUploadDiagram: boolean;
  canRollbackDiagram: boolean;
  canEditMap: boolean;
  canPublishMap: boolean;
  canReplaceSectionThumbnail: boolean;
  canReplaceEquipmentThumbnail: boolean;
  canAssignEquipment: boolean;
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

export function DiagramManager({
  vesselId,
  vesselName,
  permissions,
}: {
  vesselId: string;
  vesselName: string;
  permissions: PermissionSet;
}) {
  const diagramsQuery = useVesselDiagrams(vesselId);
  const mapsQuery = useSectionMaps(vesselId);
  const createDiagram = useCreateDiagram();
  const [uploadDiagram, setUploadDiagram] = useState<RegistryDiagramRecord | null>(null);
  const [, setLocation] = useLocation();
  const diagrams = diagramsQuery.data ?? [];
  const maps = mapsQuery.data ?? [];

  const createDiagramForType = (type: DiagramTypeDefinition) => {
    createDiagram.mutate({
      vesselId,
      payload: {
        diagramType: type.key,
        title: type.label,
        description: type.defaultFor,
      },
    });
  };

  return (
    <section className="space-y-4" data-testid="diagram-manager">
      <div className="flex flex-col justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Diagram Manager</h1>
          <p className="text-sm text-muted-foreground">{vesselName}</p>
        </div>
        {!permissions.canConfigure && (
          <PermissionDeniedInline message="You can view this registry, but you do not have permission to configure diagrams." />
        )}
      </div>

      {diagramsQuery.isLoading && <LoadingState message="Loading diagram registry." />}
      {diagramsQuery.isError && <ErrorState message="Diagram registry could not be loaded." />}
      {!diagramsQuery.isLoading && !diagramsQuery.isError && diagrams.length === 0 && (
        <EmptyState message="No vessel diagrams uploaded yet. Upload a side elevation, deck plan, or machinery arrangement to start." />
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DIAGRAM_TYPES.map((type) => {
          const diagram = diagrams.find((item) => item.diagramType === type.key);
          const map = diagram ? mapForDiagram(maps, diagram) : undefined;
          return (
            <DiagramTypeCard
              key={type.key}
              type={type}
              diagram={diagram}
              sectionMap={map}
              permissions={permissions}
              creating={createDiagram.isPending}
              onCreate={() => createDiagramForType(type)}
              onUpload={() => diagram && setUploadDiagram(diagram)}
              onVersions={() =>
                diagram &&
                setLocation(`/vessel-intelligence/${vesselId}/diagrams/${diagram.id}/versions`)
              }
              onDetail={() =>
                diagram && setLocation(`/vessel-intelligence/${vesselId}/diagrams/${diagram.id}`)
              }
              onEditMap={() =>
                map && setLocation(`/vessel-intelligence/${vesselId}/section-maps/${map.id}/edit`)
              }
              onValidateMap={() =>
                map &&
                setLocation(`/vessel-intelligence/${vesselId}/section-maps/${map.id}/validate`)
              }
              onThumbnails={() => setLocation(`/vessel-intelligence/${vesselId}/thumbnails`)}
            />
          );
        })}
      </div>

      {uploadDiagram && (
        <DiagramUploadReplaceDialog
          vesselId={vesselId}
          diagram={uploadDiagram}
          open={Boolean(uploadDiagram)}
          onOpenChange={(open) => !open && setUploadDiagram(null)}
        />
      )}
    </section>
  );
}

export function DiagramTypeCard({
  type,
  diagram,
  sectionMap,
  permissions,
  creating,
  onCreate,
  onUpload,
  onVersions,
  onDetail,
  onEditMap,
  onValidateMap,
  onThumbnails,
}: {
  type: DiagramTypeDefinition;
  diagram?: RegistryDiagramRecord;
  sectionMap?: RegistrySectionMapRecord;
  permissions: PermissionSet;
  creating: boolean;
  onCreate: () => void;
  onUpload: () => void;
  onVersions: () => void;
  onDetail: () => void;
  onEditMap: () => void;
  onValidateMap: () => void;
  onThumbnails: () => void;
}) {
  const status = diagram?.status ?? "not_uploaded";
  const testId = `diagram-type-card-${type.key}`;
  return (
    <div className="rounded-md border p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{type.label}</h2>
          <p className="text-sm text-muted-foreground">{type.defaultFor}</p>
        </div>
        <Badge variant={status === "active" ? "default" : "outline"}>{statusText(status)}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <StatusLine
          label="Active version"
          value={diagram?.activeVersionId ? "Available" : "None"}
        />
        <StatusLine
          label="Section map"
          value={sectionMap ? statusText(sectionMap.status) : "No map"}
        />
        <StatusLine
          label="Last updated"
          value={formatDate((diagram as { updatedAt?: string })?.updatedAt)}
        />
        <StatusLine label="Record" value={diagram ? "Created" : "Not uploaded"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!diagram ? (
          <ActionButton
            icon={Plus}
            label="Create diagram"
            allowed={permissions.canConfigure}
            reason="Requires vessel-intelligence:configure"
            loading={creating}
            onClick={onCreate}
          />
        ) : (
          <ActionButton icon={Eye} label="Open" allowed onClick={onDetail} />
        )}
        <ActionButton
          testId="button-upload-replace-diagram"
          icon={Upload}
          label="Upload / Replace"
          allowed={Boolean(diagram && permissions.canUploadDiagram)}
          reason={diagram ? "Requires vessel-intelligence:upload-diagram" : "Create diagram first"}
          onClick={onUpload}
        />
        <ActionButton
          testId="button-view-versions"
          icon={History}
          label="View versions"
          allowed={Boolean(diagram)}
          reason="Create diagram first"
          onClick={onVersions}
        />
        <ActionButton
          icon={Map}
          label="Edit section map"
          allowed={Boolean(sectionMap && permissions.canEditMap)}
          reason={
            sectionMap
              ? "Requires vessel-intelligence:edit-section-map"
              : "No section map exists for this diagram"
          }
          onClick={onEditMap}
        />
        <ActionButton
          testId="button-validate-map"
          icon={CheckCircle}
          label="Validate map"
          allowed={Boolean(sectionMap && permissions.canEditMap)}
          reason={
            sectionMap
              ? "Requires vessel-intelligence:edit-section-map"
              : "No section map exists for this diagram"
          }
          onClick={onValidateMap}
        />
        <ActionButton
          testId="button-manage-thumbnails"
          icon={ImagePlus}
          label="Manage thumbnails"
          allowed
          onClick={onThumbnails}
        />
      </div>
    </div>
  );
}

export function DiagramDetailPage({
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
  const mapsQuery = useSectionMaps(vesselId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [, setLocation] = useLocation();
  const diagram = diagramQuery.data;
  const versions = versionsQuery.data ?? [];
  const active = versions.find((version) => version.status === "active");
  const draft = versions.find(
    (version) => version.status === "draft" || version.status === "uploaded"
  );
  const linkedMaps = (mapsQuery.data ?? []).filter((map) => map.diagramId === diagramId);
  const currentMap = linkedMaps.find((map) => map.status === "draft") ?? linkedMaps[0];

  return (
    <section className="space-y-4">
      {diagramQuery.isLoading && <LoadingState message="Loading diagram detail." />}
      {diagramQuery.isError && <ErrorState message="Diagram detail could not be loaded." />}
      {diagram && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-md border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-semibold tracking-normal">{diagram.title}</h1>
                  <p className="text-sm text-muted-foreground">{statusText(diagram.diagramType)}</p>
                </div>
                <Badge>{statusText(diagram.status)}</Badge>
              </div>
              {active?.mediaUrl || draft?.mediaUrl ? (
                <div className="overflow-hidden rounded-md border bg-muted">
                  <img
                    src={active?.mediaUrl ?? draft?.mediaUrl}
                    alt={diagram.title}
                    className="h-auto w-full object-contain"
                  />
                </div>
              ) : (
                <EmptyState message="This diagram has no active version. Upload and publish a version." />
              )}
            </div>
            <div className="space-y-3 rounded-md border p-4">
              <StatusLine
                label="Active version"
                value={active ? `v${active.versionNumber}` : "None"}
              />
              <StatusLine
                label="Draft version"
                value={draft ? `v${draft.versionNumber}` : "None"}
              />
              <StatusLine
                label="Validation"
                value={
                  currentMap?.validationSummary
                    ? `${currentMap.validationSummary.blockers} blockers`
                    : "Not validated"
                }
              />
              <StatusLine label="Linked maps" value={String(linkedMaps.length)} />
              <ActionButton
                testId="button-upload-replace-diagram"
                icon={Upload}
                label="Upload new version"
                allowed={permissions.canUploadDiagram}
                reason="Requires vessel-intelligence:upload-diagram"
                onClick={() => setUploadOpen(true)}
              />
              <ActionButton
                testId="button-view-versions"
                icon={History}
                label="Version history"
                allowed
                onClick={() =>
                  setLocation(`/vessel-intelligence/${vesselId}/diagrams/${diagramId}/versions`)
                }
              />
              <ActionButton
                icon={Map}
                label="Edit section map"
                allowed={Boolean(currentMap && permissions.canEditMap)}
                reason={
                  currentMap
                    ? "Requires vessel-intelligence:edit-section-map"
                    : "No section map exists for this diagram. Start blank, copy from another vessel, or use a vessel type template."
                }
                onClick={() =>
                  currentMap &&
                  setLocation(`/vessel-intelligence/${vesselId}/section-maps/${currentMap.id}/edit`)
                }
              />
              <ActionButton
                testId="button-validate-map"
                icon={CheckCircle}
                label="Validate map"
                allowed={Boolean(currentMap && permissions.canEditMap)}
                reason={
                  currentMap
                    ? "Requires vessel-intelligence:edit-section-map"
                    : "No section map exists for this diagram. Start blank, copy from another vessel, or use a vessel type template."
                }
                onClick={() =>
                  currentMap &&
                  setLocation(
                    `/vessel-intelligence/${vesselId}/section-maps/${currentMap.id}/validate`
                  )
                }
              />
            </div>
          </div>
          <DiagramUploadReplaceDialog
            vesselId={vesselId}
            diagram={diagram}
            open={uploadOpen}
            onOpenChange={setUploadOpen}
          />
        </>
      )}
    </section>
  );
}

export function DiagramUploadReplaceDialog({
  vesselId,
  diagram,
  open,
  onOpenChange,
}: {
  vesselId: string;
  diagram: RegistryDiagramRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [behavior, setBehavior] = useState<ReplacementBehavior>("keep_existing");
  const [sourceVesselId, setSourceVesselId] = useState("");
  const [sourceMapId, setSourceMapId] = useState("");
  const [templateId, setTemplateId] = useState("osv_workboat");
  const [mapName, setMapName] = useState("");
  const upload = useUploadDiagramVersion();
  const templatesQuery = useSectionMapTemplates();
  const mapsQuery = useSectionMaps(vesselId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const submit = async () => {
    if (!file) {
      toast({
        title: "File rejected",
        description: "Choose a diagram file before uploading.",
        variant: "destructive",
      });
      return;
    }
    const result = await upload.mutateAsync({
      vesselId,
      diagramId: diagram.id,
      file,
      replacementBehavior: behavior,
      sourceVesselId: behavior === "copy_vessel" ? sourceVesselId : undefined,
      sourceMapId: behavior === "copy_vessel" ? sourceMapId : undefined,
      templateId: behavior === "copy_template" ? templateId : undefined,
      mapName: mapName || undefined,
    });
    const draftMap = result.draftMap;
    onOpenChange(false);
    if (draftMap?.id) {
      setLocation(`/vessel-intelligence/${vesselId}/section-maps/${draftMap.id}/edit`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-upload-replace-diagram">
        <DialogHeader>
          <DialogTitle>Upload / Replace Diagram</DialogTitle>
          <DialogDescription>{diagram.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="diagram-upload-file">Diagram file</Label>
            <Input
              id="diagram-upload-file"
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="diagram-map-name">Draft map name</Label>
            <Input
              id="diagram-map-name"
              value={mapName}
              onChange={(event) => setMapName(event.target.value)}
              placeholder={`${diagram.title} draft map`}
            />
          </div>
          <ReplacementBehaviorSelector value={behavior} onChange={setBehavior} />
          {behavior === "copy_vessel" && (
            <CopyFromVesselDialog
              maps={mapsQuery.data ?? []}
              sourceVesselId={sourceVesselId}
              sourceMapId={sourceMapId}
              onSourceVesselIdChange={setSourceVesselId}
              onSourceMapIdChange={setSourceMapId}
            />
          )}
          {behavior === "copy_template" && (
            <CopyFromTemplateDialog
              templates={templatesQuery.data ?? []}
              templateId={templateId}
              onTemplateIdChange={setTemplateId}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="button-submit-upload-replace"
            onClick={() => void submit()}
            disabled={
              upload.isPending ||
              !file ||
              (behavior === "copy_vessel" && (!sourceVesselId || !sourceMapId))
            }
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReplacementBehaviorSelector({
  value,
  onChange,
}: {
  value: ReplacementBehavior;
  onChange: (value: ReplacementBehavior) => void;
}) {
  const options: Array<{
    value: ReplacementBehavior;
    label: string;
    description: string;
    testId: string;
  }> = [
    {
      value: "keep_existing",
      label: "Keep existing section map as draft overlay",
      description: "Clone the current map as a draft over the new schematic.",
      testId: "replacement-option-keep-existing",
    },
    {
      value: "start_blank",
      label: "Start blank section map",
      description: "Create an empty draft map for fresh sections.",
      testId: "replacement-option-start-blank",
    },
    {
      value: "copy_vessel",
      label: "Copy section map from another vessel",
      description: "Clone a source map without blindly copying equipment assignments.",
      testId: "replacement-option-copy-vessel",
    },
    {
      value: "copy_template",
      label: "Copy section map from vessel type template",
      description: "Use a backend template as the draft map starter.",
      testId: "replacement-option-copy-template",
    },
  ];
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as ReplacementBehavior)}
      className="grid gap-2"
    >
      {options.map((option) => (
        <label
          key={option.value}
          htmlFor={option.value}
          className="flex cursor-pointer gap-3 rounded-md border p-3 text-sm"
          data-testid={option.testId}
        >
          <RadioGroupItem id={option.value} value={option.value} />
          <span>
            <span className="block font-medium">{option.label}</span>
            <span className="block text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function CopyFromVesselDialog({
  maps,
  sourceVesselId,
  sourceMapId,
  onSourceVesselIdChange,
  onSourceMapIdChange,
}: {
  maps: RegistrySectionMapRecord[];
  sourceVesselId: string;
  sourceMapId: string;
  onSourceVesselIdChange: (value: string) => void;
  onSourceMapIdChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="source-vessel-id">Source vessel ID</Label>
        <Input
          id="source-vessel-id"
          value={sourceVesselId}
          onChange={(event) => onSourceVesselIdChange(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Source map</Label>
        <Select value={sourceMapId} onValueChange={onSourceMapIdChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose source map" />
          </SelectTrigger>
          <SelectContent>
            {maps.map((map) => (
              <SelectItem key={map.id} value={map.id}>
                {map.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function CopyFromTemplateDialog({
  templates,
  templateId,
  onTemplateIdChange,
}: {
  templates: Array<{ id: string; name: string; description: string }>;
  templateId: string;
  onTemplateIdChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <Label>Vessel type template</Label>
      <Select value={templateId} onValueChange={onTemplateIdChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {templates.find((template) => template.id === templateId)?.description ??
          "Template registry loading."}
      </p>
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
    const selectedEquipment = equipment.find(
      (item) => equipmentIdForThumbnail(item) === equipmentId
    );
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
                        {equipment.map((item) => (
                          <SelectItem
                            key={equipmentIdForThumbnail(item)}
                            value={equipmentIdForThumbnail(item)}
                          >
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

export function PermissionDeniedInline({ message }: { message: string }) {
  return (
    <Alert>
      <AlertTitle>Permission denied</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function DeadControlGuard({
  allowed,
  reason,
  children,
}: {
  allowed: boolean;
  reason: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex flex-col gap-1">
      {children}
      {!allowed && <span className="text-xs text-muted-foreground">{reason}</span>}
    </span>
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

function ActionButton({
  icon: Icon,
  label,
  allowed,
  reason = "Not available",
  loading,
  testId,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  allowed: boolean;
  reason?: string;
  loading?: boolean;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <DeadControlGuard allowed={allowed} reason={reason}>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={!allowed || loading}
        title={allowed ? label : reason}
        data-testid={testId}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icon className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    </DeadControlGuard>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
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

function mapForDiagram(maps: RegistrySectionMapRecord[], diagram: RegistryDiagramRecord) {
  return (
    maps.find(
      (map) => map.id === (diagram as { currentSectionMapId?: string | null }).currentSectionMapId
    ) ??
    maps.find((map) => map.diagramId === diagram.id && map.status === "draft") ??
    maps.find((map) => map.diagramId === diagram.id)
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

function formatDate(value: unknown) {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }
  return date.toLocaleDateString();
}
