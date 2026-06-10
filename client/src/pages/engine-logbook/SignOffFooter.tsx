import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, Save } from "lucide-react";
import { format } from "date-fns";
import { type EngineLogbookHookReturn } from "@/features/engine-logbook";
import { PermissionGate } from "@/components/PermissionGate";

export function SignOffFooter({ e }: { e: EngineLogbookHookReturn }) {
  if (!e.selectedVesselId || !e.engineLogComplete) {
    return null;
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {e.isSigned && e.engineLogComplete.daily.signedByName && (
              <div className="text-sm text-muted-foreground">
                Signed by:{" "}
                <span className="font-medium">{e.engineLogComplete.daily.signedByName}</span>
                {e.engineLogComplete.daily.signedAt && (
                  <> at {format(new Date(e.engineLogComplete.daily.signedAt), "PPp")}</>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PermissionGate resource="engine_logbook" action="edit">
              <Button
                variant="outline"
                onClick={() => e.saveMutation.mutate()}
                disabled={!e.isDirty || e.isLocked || e.saveMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {e.saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </PermissionGate>
            <PermissionGate resource="engine_logbook" action="sign_off">
              {!e.isSigned && !e.isLocked && (
                <Button
                  variant="default"
                  onClick={() => e.signMutation.mutate()}
                  disabled={e.signMutation.isPending}
                  data-testid="button-sign"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {e.signMutation.isPending ? "Signing..." : "Sign Log"}
                </Button>
              )}
            </PermissionGate>
            <PermissionGate resource="engine_logbook" action="edit">
              {e.isSigned && !e.isLocked && (
                <Button
                  variant="secondary"
                  onClick={() => e.lockMutation.mutate()}
                  disabled={e.lockMutation.isPending}
                  data-testid="button-lock"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {e.lockMutation.isPending ? "Locking..." : "Lock Log"}
                </Button>
              )}
            </PermissionGate>
            {e.isLocked && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Immutable Record
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
