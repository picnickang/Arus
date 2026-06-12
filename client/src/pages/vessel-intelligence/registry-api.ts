import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SectionMapImageTransform } from "@shared/schema-runtime";
import type {
  RegistrySectionAssignmentRecord,
  RegistrySectionMapRecord,
} from "./data";
import {
  assignmentsKey,
  invalidateVessel,
  sectionMapKey,
  sectionMapsKey,
  templatesKey,
  uploadThumbnail,
  useMutationToast,
} from "./registry-api-helpers";
import type {
  RegistrySectionMapTemplateRecord,
  RegistryValidationResult,
} from "./registry-api-types";
export { equipmentIdForThumbnail } from "./registry-identifiers";
export { registrySummaryKey } from "./registry-api-helpers";
export {
  useArchiveDiagramVersion,
  useCreateDiagram,
  useDiagramDetail,
  useDiagramVersions,
  usePublishDiagramVersion,
  useRestoreDiagramVersion,
  useUploadDiagramVersion,
  useVesselDiagrams,
} from "./registry-api-diagrams";
export type {
  RegistryDiagramVersionRecord,
  RegistrySectionMapTemplateRecord,
  RegistryValidationResult,
  ReplacementBehavior,
  UploadDiagramVersionInput,
  UploadDiagramVersionResult,
} from "./registry-api-types";

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
      payload: {
        equipmentId?: string | undefined;
        equipmentName: string;
        assetCode?: string | undefined;
        system?: string | undefined;
      };
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
