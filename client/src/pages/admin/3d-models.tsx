import { ApiError } from "@/lib/api-error";
import { useQueries, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { Vessel } from "@shared/schema";
import { VesselModelCard } from "./3d-models-card";
import { isForbiddenError, type ModelMetadata } from "./3d-models-model";

export default function Admin3DModelsPage() {
  const { toast } = useToast();

  const vesselsQuery = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const vessels = vesselsQuery.data ?? [];
  const isForbidden = isForbiddenError(vesselsQuery.error);

  const modelQueries = useQueries({
    queries: vessels.map((vessel) => ({
      queryKey: ["/api/v1/vessels", vessel.id, "3d-model"] as const,
      enabled: !isForbidden,
      queryFn: async () => {
        try {
          return await apiRequest<ModelMetadata>(
            "GET",
            `/api/v1/vessels/${encodeURIComponent(vessel.id)}/3d-model`
          );
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
    })),
  });

  if (isForbidden) {
    return (
      <div className="p-6" data-testid="page-admin-3d-models-forbidden">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <h1 className="text-lg font-semibold">Admin only</h1>
            <p className="text-sm text-muted-foreground">
              You need the admin or chief engineer role to manage 3D vessel models and equipment
              pins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-3d-models">
      <header>
        <h1 className="text-2xl font-bold">3D Vessel Models</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload self-contained <code>.glb</code> models and place equipment pins. Models stream to
          the 3D Digital Twin viewer at <code>/vessels/:id/3d</code>.
        </p>
      </header>

      {vesselsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vessels…
        </div>
      ) : vessels.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No vessels found. Add a vessel before uploading a 3D model.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vessels.map((vessel, index) => {
            const modelQuery = modelQueries[index];
            return (
              <VesselModelCard
                key={vessel.id}
                vessel={vessel}
                model={modelQuery?.data ?? null}
                loading={modelQuery?.isLoading ?? false}
                error={modelQuery?.error ?? null}
                onChanged={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["/api/v1/vessels", vessel.id, "3d-model"],
                  });
                  toast({ title: "3D model updated" });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
