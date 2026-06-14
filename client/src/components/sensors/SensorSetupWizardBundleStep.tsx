import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight, Info, Layers } from "lucide-react";
import type { Equipment } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  type WizardState,
  useBundleStepData,
  formatEquipmentType,
  formatSensorType,
} from "@/features/telemetry";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";

interface BundleStepProps {
  equipment: Pick<Equipment, "id" | "name" | "type">;
  wizardState: WizardState;
  setWizardState: Dispatch<SetStateAction<WizardState>>;
  onNext: () => void;
  onBack: () => void;
  "data-testid"?: string;
}

export function BundleStep({
  equipment,
  wizardState,
  setWizardState,
  onNext,
  onBack,
  "data-testid": dataTestId,
}: BundleStepProps) {
  const {
    bundles,
    allTemplates,
    isLoading,
    error,
    handleSelectBundle,
    handleToggleTemplate,
    validateAndProceed,
  } = useBundleStepData(equipment, wizardState, setWizardState);
  if (isLoading) {
    return (
      <div data-testid={dataTestId}>
        <LoadingState variant="card" />
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid={dataTestId}>
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={dataTestId}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Select Sensor Bundle</h3>
        <p className="text-sm text-muted-foreground">
          Choose a pre-configured sensor bundle optimized for {formatEquipmentType(equipment.type)}{" "}
          equipment, or create a custom configuration.
        </p>
      </div>
      {bundles.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No sensor bundles available for {formatEquipmentType(equipment.type)} equipment. You can
            create a custom configuration instead.
          </AlertDescription>
        </Alert>
      )}
      {bundles.length > 0 && (
        <RadioGroup
          value={wizardState.selectedBundleId || ""}
          onValueChange={handleSelectBundle}
          className="space-y-3"
        >
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${wizardState.selectedBundleId === bundle.bundleId ? "border-primary bg-muted/30" : ""}`}
              data-testid={`bundle-option-${bundle.bundleId}`}
            >
              <RadioGroupItem
                value={bundle.bundleId}
                id={bundle.bundleId}
                className="mt-1"
                data-testid={`radio-bundle-${bundle.bundleId}`}
              />
              <div className="flex-1">
                <Label htmlFor={bundle.bundleId} className="cursor-pointer space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{bundle.name}</span>
                    {bundle.isSystemDefault && (
                      <Badge variant="outline" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                  {bundle.description && (
                    <p className="text-sm text-muted-foreground">{bundle.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    <span>
                      {bundle.templateIds?.length || 0} sensor
                      {(bundle.templateIds?.length || 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </Label>
              </div>
            </div>
          ))}
        </RadioGroup>
      )}
      <div
        className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${wizardState.selectedBundleId === "custom" ? "border-primary bg-muted/30" : ""}`}
        data-testid="bundle-option-custom"
      >
        <RadioGroup value={wizardState.selectedBundleId || ""} onValueChange={handleSelectBundle}>
          <RadioGroupItem
            value="custom"
            id="custom"
            className="mt-1"
            data-testid="radio-bundle-custom"
          />
        </RadioGroup>
        <div className="flex-1">
          <Label htmlFor="custom" className="cursor-pointer space-y-2">
            <div className="font-semibold">Custom Selection</div>
            <p className="text-sm text-muted-foreground">
              Manually choose which sensors to configure (advanced users)
            </p>
          </Label>
        </div>
      </div>
      {wizardState.selectedBundleId === "custom" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Individual Sensors</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which sensors to configure for this equipment
            </p>
          </CardHeader>
          <CardContent>
            {allTemplates.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No sensor templates available. Please contact support.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allTemplates.map((template) => (
                  <div
                    key={template.templateId}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    data-testid={`template-option-${template.kind}`}
                  >
                    <Checkbox
                      id={`template-${template.templateId}`}
                      checked={
                        wizardState.customSensorSelections?.includes(template.templateId) || false
                      }
                      onCheckedChange={(checked) =>
                        handleToggleTemplate(template.templateId, checked as boolean)
                      }
                      data-testid={`checkbox-template-${template.kind}`}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`template-${template.templateId}`}
                        className="cursor-pointer space-y-1"
                      >
                        <div className="font-medium text-sm">{formatSensorType(template.kind)}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {template.unit || "N/A"}
                          </Badge>
                          {template.notes && <span className="line-clamp-1">{template.notes}</span>}
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {wizardState.customSensorSelections &&
              wizardState.customSensorSelections.length > 0 && (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {wizardState.customSensorSelections.length} sensor
                    {wizardState.customSensorSelections.length !== 1 ? "s" : ""} selected
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      )}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => validateAndProceed(onNext)}
          disabled={!wizardState.selectedBundleId}
          data-testid="button-next-step"
        >
          Next: Tune Thresholds
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
