import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { RegistryDiagramRecord } from "./data";
import type { RegistryDiagramVersionRecord } from "./registry-api-types";
import {
  diagramKey,
  diagramsKey,
  invalidateVessel,
  uploadDiagramVersion,
  useMutationToast,
  versionsKey,
} from "./registry-api-helpers";

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
