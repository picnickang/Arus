import { useToast } from "@/hooks/use-toast";
import { apiFormDataRequest, queryClient } from "@/lib/queryClient";
import type {
  MutationMessage,
  UploadDiagramVersionInput,
  UploadDiagramVersionResult,
} from "./registry-api-types";

export function registrySummaryKey(vesselId: string) {
  return ["/api/vessel-intelligence", vesselId, "summary"] as const;
}

export function diagramsKey(vesselId: string) {
  return ["/api/vessel-intelligence", vesselId, "diagrams"] as const;
}

export function diagramKey(vesselId: string, diagramId: string) {
  return ["/api/vessel-intelligence", vesselId, "diagrams", diagramId] as const;
}

export function versionsKey(vesselId: string, diagramId: string) {
  return ["/api/vessel-intelligence", vesselId, "diagrams", diagramId, "versions"] as const;
}

export function sectionMapsKey(vesselId: string) {
  return ["/api/vessel-intelligence", vesselId, "section-maps"] as const;
}

export function sectionMapKey(vesselId: string, mapId: string) {
  return ["/api/vessel-intelligence", vesselId, "section-maps", mapId] as const;
}

export function assignmentsKey(vesselId: string, mapId: string) {
  return ["/api/vessel-intelligence", vesselId, "section-maps", mapId, "assignments"] as const;
}

export function templatesKey() {
  return ["/api/vessel-intelligence", "section-map-templates"] as const;
}

export function useMutationToast(message: MutationMessage) {
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

export async function invalidateVessel(
  vesselId: string,
  diagramId?: string,
  mapId?: string
) {
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

export async function uploadDiagramVersion(
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

export async function uploadThumbnail(url: string, file: File) {
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
