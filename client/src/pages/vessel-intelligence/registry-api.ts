import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFormDataRequest, apiRequest, queryClient } from "@/lib/queryClient";
import type { SectionMapImageTransform } from "@shared/schema-runtime";
import type {
  RegistryDiagramRecord,
  RegistrySectionAssignmentRecord,
  RegistrySectionMapRecord,
} from "./data";
export { equipmentIdForThumbnail } from "./registry-identifiers";

export interface RegistryDiagramVersionRecord {
  id: string;
  vesselId: string;
  diagramId: string;
  versionNumber: number;
  status: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy?: string | null;
  uploadedAt?: string | Date | null;
  publishedBy?: string | null;
  publishedAt?: string | Date | null;
  mediaUrl?: string;
}

export interface RegistrySectionMapTemplateRecord {
  id: string;
  name: string;
  vesselType: string;
  description: string;
  diagramKind: string;
  diagramWidth: number;
  diagramHeight: number;
  sections: Array<{ name: string; sectionKey: string; color: string }>;
}

export interface RegistryValidationResult {
  summary: { blockers: number; warnings: number; checkedAt: string };
  issues: Array<{ severity: "blocker" | "warning"; code: string; message: string; path?: string }>;
}

export type ReplacementBehavior = "keep_existing" | "start_blank" | "copy_vessel" | "copy_template";

export interface UploadDiagramVersionInput {
  vesselId: string;
  diagramId: string;
  file: File;
  replacementBehavior?: ReplacementBehavior;
  sourceVesselId?: string;
  sourceMapId?: string;
  templateId?: string;
  mapName?: string;
}

export interface UploadDiagramVersionResult {
  version?: RegistryDiagramVersionRecord;
  draftMap?: RegistrySectionMapRecord | null;
  warnings?: string[];
  id?: string;
}

type MutationMessage = {
  success: string;
  failure: string;
};

export function registrySummaryKey(vesselId: string) {
  return ["/api/vessel-intelligence", vesselId, "summary"] as const;
}

function diagramsKey(vesselId: string) {
  return ["/api/vessel-intelligence", vesselId, "diagrams"] as const;
}

function diagramKey(vesselId: string, diagramId: string) {
  return ["/api/vessel-intelligence", vesselId, "diagrams", diagramId] as const;
}

function versionsKey(vesselId: string, diagramId: string) {
  return ["/api/vessel-intelligence", vesselId, "diagrams", diagramId, "versions"] as const;
}

function sectionMapsKey(vesselId: string) {
  return ["/api/vessel-intelligence", vesselId, "section-maps"] as const;
}

function sectionMapKey(vesselId: string, mapId: string) {
  return ["/api/vessel-intelligence", vesselId, "section-maps", mapId] as const;
}

function assignmentsKey(vesselId: string, mapId: string) {
  return ["/api/vessel-intelligence", vesselId, "section-maps", mapId, "assignments"] as const;
}

function templatesKey() {
  return ["/api/vessel-intelligence", "section-map-templates"] as const;
}

function useMutationToast(message: MutationMessage) {
  const { toast } = useToast();
  return {
    onSuccess: () => toast({ title: message.success }),
    onError: (error: unknown) =>
      toast({
        title: message.failure,
        description: error instanceof Error ? error.message : "The registry API returned an error.",
        variant: "destructive",
      }),
  };
}

async function invalidateVessel(vesselId: string, diagramId?: string, mapId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: registrySummaryKey(vesselId) }),
    queryClient.invalidateQueries({ queryKey: diagramsKey(vesselId) }),
    queryClient.invalidateQueries({ queryKey: sectionMapsKey(vesselId) }),
    diagramId
      ? queryClient.invalidateQueries({ queryKey: versionsKey(vesselId, diagramId) })
      : Promise.resolve(),
    diagramId
      ? queryClient.invalidateQueries({ queryKey: diagramKey(vesselId, diagramId) })
      : Promise.resolve(),
    mapId
      ? queryClient.invalidateQueries({ queryKey: sectionMapKey(vesselId, mapId) })
      : Promise.resolve(),
    mapId
      ? queryClient.invalidateQueries({ queryKey: assignmentsKey(vesselId, mapId) })
      : Promise.resolve(),
  ]);
}

export function useVesselDiagrams(vesselId: string | undefined) {
  return useQuery({
    queryKey: vesselId
      ? diagramsKey(vesselId)
      : ["/api/vessel-intelligence", "no-vessel", "diagrams"],
    queryFn: () =>
      apiRequest<RegistryDiagramRecord[]>("GET", `/api/vessel-intelligence/${vesselId}/diagrams`),
    enabled: Boolean(vesselId),
  });
}

export function useCreateDiagram() {
  const callbacks = useMutationToast({
    success: "Diagram created",
    failure: "Create diagram failed",
  });
  return useMutation({
    mutationFn: (input: {
      vesselId: string;
      payload: { diagramType: string; title: string; description?: string };
    }) =>
      apiRequest<RegistryDiagramRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/diagrams`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId);
    },
    onError: callbacks.onError,
  });
}

export function useDiagramDetail(vesselId: string | undefined, diagramId: string | undefined) {
  return useQuery({
    queryKey:
      vesselId && diagramId
        ? diagramKey(vesselId, diagramId)
        : ["/api/vessel-intelligence", "no-diagram"],
    queryFn: () =>
      apiRequest<RegistryDiagramRecord>(
        "GET",
        `/api/vessel-intelligence/${vesselId}/diagrams/${diagramId}`
      ),
    enabled: Boolean(vesselId && diagramId),
  });
}

export function useDiagramVersions(vesselId: string | undefined, diagramId: string | undefined) {
  return useQuery({
    queryKey:
      vesselId && diagramId
        ? versionsKey(vesselId, diagramId)
        : ["/api/vessel-intelligence", "no-versions"],
    queryFn: () =>
      apiRequest<RegistryDiagramVersionRecord[]>(
        "GET",
        `/api/vessel-intelligence/${vesselId}/diagrams/${diagramId}/versions`
      ),
    enabled: Boolean(vesselId && diagramId),
  });
}

export function useUploadDiagramVersion() {
  const callbacks = useMutationToast({
    success: "Diagram version uploaded",
    failure: "Diagram upload failed",
  });
  return useMutation({
    mutationFn: uploadDiagramVersion,
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, input.diagramId);
    },
    onError: callbacks.onError,
  });
}

export function usePublishDiagramVersion() {
  const callbacks = useMutationToast({ success: "Version published", failure: "Publish failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; diagramId: string; versionId: string }) =>
      apiRequest<RegistryDiagramVersionRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/diagrams/${input.diagramId}/versions/${input.versionId}/publish`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, input.diagramId);
    },
    onError: callbacks.onError,
  });
}

export function useArchiveDiagramVersion() {
  const callbacks = useMutationToast({ success: "Version archived", failure: "Archive failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; diagramId: string; versionId: string }) =>
      apiRequest<RegistryDiagramVersionRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/diagrams/${input.diagramId}/versions/${input.versionId}/archive`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, input.diagramId);
    },
    onError: callbacks.onError,
  });
}

export function useRestoreDiagramVersion() {
  const callbacks = useMutationToast({ success: "Draft restored", failure: "Restore failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; diagramId: string; versionId: string }) =>
      apiRequest<RegistryDiagramVersionRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/diagrams/${input.diagramId}/versions/${input.versionId}/restore-draft`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, input.diagramId);
    },
    onError: callbacks.onError,
  });
}

export function useSectionMaps(vesselId: string | undefined) {
  return useQuery({
    queryKey: vesselId
      ? sectionMapsKey(vesselId)
      : ["/api/vessel-intelligence", "no-vessel", "section-maps"],
    queryFn: () =>
      apiRequest<RegistrySectionMapRecord[]>(
        "GET",
        `/api/vessel-intelligence/${vesselId}/section-maps`
      ),
    enabled: Boolean(vesselId),
  });
}

export function useSectionMap(vesselId: string | undefined, mapId: string | undefined) {
  return useQuery({
    queryKey:
      vesselId && mapId
        ? sectionMapKey(vesselId, mapId)
        : ["/api/vessel-intelligence", "no-section-map"],
    queryFn: () =>
      apiRequest<RegistrySectionMapRecord>(
        "GET",
        `/api/vessel-intelligence/${vesselId}/section-maps/${mapId}`
      ),
    enabled: Boolean(vesselId && mapId),
  });
}

export function useCreateSectionMap() {
  const callbacks = useMutationToast({
    success: "Section map created",
    failure: "Map creation failed",
  });
  return useMutation({
    mutationFn: (input: { vesselId: string; payload: Record<string, unknown> }) =>
      apiRequest<RegistrySectionMapRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/section-maps`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId);
    },
    onError: callbacks.onError,
  });
}

export function useCloneSectionMap() {
  const callbacks = useMutationToast({ success: "Map cloned", failure: "Map clone failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; mapId: string; payload: Record<string, unknown> }) =>
      apiRequest<RegistrySectionMapRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/clone`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useUpdateSectionMapCalibration() {
  const callbacks = useMutationToast({
    success: "Side elevation fit saved",
    failure: "Side elevation fit save failed",
  });
  return useMutation({
    mutationFn: (input: {
      vesselId: string;
      mapId: string;
      imageTransform: SectionMapImageTransform;
    }) =>
      apiRequest<RegistrySectionMapRecord>(
        "PATCH",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}`,
        { imageTransform: input.imageTransform }
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useValidateSectionMap() {
  const callbacks = useMutationToast({ success: "Map validated", failure: "Validation failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; mapId: string }) =>
      apiRequest<RegistryValidationResult>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/validate`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function usePublishSectionMap() {
  const callbacks = useMutationToast({ success: "Map published", failure: "Map publish failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; mapId: string }) =>
      apiRequest<RegistrySectionMapRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/publish`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useSectionAssignments(vesselId: string | undefined, mapId: string | undefined) {
  return useQuery({
    queryKey:
      vesselId && mapId
        ? assignmentsKey(vesselId, mapId)
        : ["/api/vessel-intelligence", "no-assignments"],
    queryFn: () =>
      apiRequest<RegistrySectionAssignmentRecord[]>(
        "GET",
        `/api/vessel-intelligence/${vesselId}/section-maps/${mapId}/equipment-assignments`
      ),
    enabled: Boolean(vesselId && mapId),
  });
}

export function useAssignEquipmentToSection() {
  const callbacks = useMutationToast({
    success: "Equipment assigned",
    failure: "Equipment assignment failed",
  });
  return useMutation({
    mutationFn: (input: {
      vesselId: string;
      mapId: string;
      sectionId: string;
      payload: { equipmentId?: string; equipmentName: string; assetCode?: string; system?: string };
    }) =>
      apiRequest<RegistrySectionAssignmentRecord>(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/sections/${input.sectionId}/equipment`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useUploadSectionThumbnail() {
  const callbacks = useMutationToast({
    success: "Section thumbnail uploaded",
    failure: "Thumbnail upload failed",
  });
  return useMutation({
    mutationFn: (input: { vesselId: string; sectionId: string; file: File }) =>
      uploadThumbnail(
        `/api/vessel-intelligence/${input.vesselId}/sections/${input.sectionId}/thumbnail`,
        input.file
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId);
    },
    onError: callbacks.onError,
  });
}

export function useUploadEquipmentThumbnail() {
  const callbacks = useMutationToast({
    success: "Equipment thumbnail uploaded",
    failure: "Thumbnail upload failed",
  });
  return useMutation({
    mutationFn: (input: { vesselId: string; equipmentId: string; file: File }) =>
      uploadThumbnail(
        `/api/vessel-intelligence/${input.vesselId}/equipment/${input.equipmentId}/thumbnail`,
        input.file
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId);
    },
    onError: callbacks.onError,
  });
}

export function useDeleteSectionThumbnail() {
  const callbacks = useMutationToast({
    success: "Section thumbnail deleted",
    failure: "Thumbnail delete failed",
  });
  return useMutation({
    mutationFn: (input: { vesselId: string; sectionId: string }) =>
      apiRequest<null>(
        "DELETE",
        `/api/vessel-intelligence/${input.vesselId}/sections/${input.sectionId}/thumbnail`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId);
    },
    onError: callbacks.onError,
  });
}

export function useDeleteEquipmentThumbnail() {
  const callbacks = useMutationToast({
    success: "Equipment thumbnail deleted",
    failure: "Thumbnail delete failed",
  });
  return useMutation({
    mutationFn: (input: { vesselId: string; equipmentId: string }) =>
      apiRequest<null>(
        "DELETE",
        `/api/vessel-intelligence/${input.vesselId}/equipment/${input.equipmentId}/thumbnail`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId);
    },
    onError: callbacks.onError,
  });
}

export function useSectionMapTemplates() {
  return useQuery({
    queryKey: templatesKey(),
    queryFn: () =>
      apiRequest<RegistrySectionMapTemplateRecord[]>(
        "GET",
        "/api/vessel-intelligence/section-map-templates"
      ),
  });
}

export function useAddSection() {
  const callbacks = useMutationToast({ success: "Section saved", failure: "Section save failed" });
  return useMutation({
    mutationFn: (input: { vesselId: string; mapId: string; payload: Record<string, unknown> }) =>
      apiRequest(
        "POST",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/sections`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useUpdateSection() {
  const callbacks = useMutationToast({
    success: "Section updated",
    failure: "Section update failed",
  });
  return useMutation({
    mutationFn: (input: {
      vesselId: string;
      mapId: string;
      sectionId: string;
      payload: Record<string, unknown>;
    }) =>
      apiRequest(
        "PATCH",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/sections/${input.sectionId}`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useUpdateSectionPolygon() {
  const callbacks = useMutationToast({
    success: "Polygon updated",
    failure: "Polygon update failed",
  });
  return useMutation({
    mutationFn: (input: {
      vesselId: string;
      mapId: string;
      sectionId: string;
      payload: Record<string, unknown>;
    }) =>
      apiRequest(
        "PUT",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/sections/${input.sectionId}/polygon`,
        input.payload
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

export function useRemoveEquipmentAssignment() {
  const callbacks = useMutationToast({
    success: "Equipment assignment removed",
    failure: "Remove assignment failed",
  });
  return useMutation({
    mutationFn: (input: {
      vesselId: string;
      mapId: string;
      sectionId: string;
      assignmentId: string;
    }) =>
      apiRequest<null>(
        "DELETE",
        `/api/vessel-intelligence/${input.vesselId}/section-maps/${input.mapId}/sections/${input.sectionId}/equipment/${input.assignmentId}`
      ),
    onSuccess: async (_result, input) => {
      callbacks.onSuccess();
      await invalidateVessel(input.vesselId, undefined, input.mapId);
    },
    onError: callbacks.onError,
  });
}

async function uploadDiagramVersion(
  input: UploadDiagramVersionInput
): Promise<UploadDiagramVersionResult> {
  const data = new FormData();
  data.set("file", input.file);
  if (input.replacementBehavior) {
    data.set("replacementBehavior", input.replacementBehavior);
  }
  if (input.sourceVesselId) {
    data.set("sourceVesselId", input.sourceVesselId);
  }
  if (input.sourceMapId) {
    data.set("sourceMapId", input.sourceMapId);
  }
  if (input.templateId) {
    data.set("templateId", input.templateId);
  }
  if (input.mapName) {
    data.set("mapName", input.mapName);
  }
  return uploadFormData(
    `/api/vessel-intelligence/${input.vesselId}/diagrams/${input.diagramId}/versions/upload`,
    data
  );
}

async function uploadThumbnail(url: string, file: File) {
  const data = new FormData();
  data.set("file", file);
  return uploadFormData(url, data);
}

async function uploadFormData<T = UploadDiagramVersionResult>(
  url: string,
  body: FormData
): Promise<T> {
  return apiFormDataRequest<T>("POST", url, body);
}
