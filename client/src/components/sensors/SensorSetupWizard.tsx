import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Settings,
  Info,
} from "lucide-react";
import { Equipment, SensorConfiguration } from "@shared/schema";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { QueryBoundary } from "@/components/patterns/QueryBoundary";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import {
  type WizardState,
  type SensorSetupWizardProps,
  useSensorWizardData,
  useEquipmentStepData,
  useBundleStepData,
  useThresholdStepData,
  formatEquipmentType,
  formatSensorType,
} from "@/features/telemetry";

export function SensorSetupWizard({ equipment, open, onClose, onSuccess }: SensorSetupWizardProps) {
  const { wizardState, setWizardState, progress, handleNext, handleBack, handleClose } =
    useSensorWizardData({
      equipment: equipment as object as Parameters<typeof useSensorWizardData>[0]["equipment"],
      onClose,
      ...(onSuccess !== undefined && { onSuccess }),
    });

  if (!equipment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sensor Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Configure sensors for {equipment.name} in 3 easy steps
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Step {wizardState.currentStep} of 3</span>
              <span className="font-medium">
                {wizardState.currentStep === 1 && "Equipment Confirmation"}
                {wizardState.currentStep === 2 && "Select Sensor Bundle"}
                {wizardState.currentStep === 3 && "Tune Thresholds"}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <Separator />
          {wizardState.currentStep === 1 && (
            <EquipmentStep
              equipment={
                equipment as object as Pick<Equipment, "id" | "name" | "type" | "location"> & {
                  status?: string | null;
                }
              }
              onNext={handleNext}
              data-testid="wizard-step-1"
            />
          )}
          {wizardState.currentStep === 2 && (
            <BundleStep
              equipment={equipment}
              wizardState={wizardState}
              setWizardState={setWizardState}
              onNext={handleNext}
              onBack={handleBack}
              data-testid="wizard-step-2"
            />
          )}
          {wizardState.currentStep === 3 && (
            <ThresholdStep
              equipment={equipment as object as Equipment}
              wizardState={wizardState}
              onBack={handleBack}
              {...(onSuccess !== undefined && { onSuccess })}
              onClose={handleClose}
              data-testid="wizard-step-3"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EquipmentStepProps {
  equipment: Pick<Equipment, "id" | "name" | "type" | "location"> & { status?: string | null };
  onNext: () => void;
  "data-testid"?: string;
}

function EquipmentStep({ equipment, onNext, "data-testid": dataTestId }: EquipmentStepProps) {
  const { existingSensors, sensorsByType, isLoading, error } = useEquipmentStepData(equipment.id);
  return (
    <QueryBoundary
      isLoading={isLoading}
      error={error}
      loadingVariant="card"
      data-testid={dataTestId}
    >
      <div className="space-y-6" data-testid={dataTestId}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Equipment Name</Label>
              <div className="text-lg font-semibold" data-testid="equipment-name-display">
                {equipment.name}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Equipment Type</Label>
                <div className="font-medium" data-testid="equipment-type-display">
                  {String(formatEquipmentType(equipment.type) ?? "")}
                </div>
              </div>
              {equipment.status && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Status</Label>
                  <div data-testid="equipment-status-display">
                    <Badge variant={equipment.status === "active" ? "default" : "outline"}>
                      {String(equipment.status)}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            {equipment.location && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Location</Label>
                <div data-testid="equipment-location-display">{equipment.location}</div>
              </div>
            )}
          </CardContent>
        </Card>
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            We'll recommend sensors optimized for{" "}
            <strong>{formatEquipmentType(equipment.type)}</strong> equipment based on industry best
            practices and predictive maintenance requirements.
          </AlertDescription>
        </Alert>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Current Sensor Configuration</h3>
            <Badge variant="secondary" className="text-sm" data-testid="sensor-count-badge">
              {existingSensors.length} sensor{existingSensors.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          {existingSensors.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  No sensors configured yet. Let's set up your first sensors!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {Object.entries(sensorsByType).map(([type, sensors]) => (
                <SensorTypeCard key={type} type={type} sensors={sensors} />
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={onNext} data-testid="button-next-step">
            Next: Select Bundle
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </QueryBoundary>
  );
}

function SensorTypeCard({ type, sensors }: { type: string; sensors: SensorConfiguration[] }) {
  return (
    <Card className="border-l-4 border-l-primary" data-testid={`sensor-type-card-${type}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatSensorType(type)}</span>
              <Badge variant="outline" className="text-xs">
                {sensors.length} config{sensors.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {sensors.map((sensor) => (
                <SensorStatusBadge key={sensor.id} sensor={sensor} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SensorStatusBadge({ sensor }: { sensor: SensorConfiguration }) {
  return (
    <div className="flex items-center gap-1 text-xs" data-testid={`sensor-status-${sensor.id}`}>
      {sensor.enabled ? (
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      ) : (
        <AlertCircle className="h-3 w-3 text-gray-400" />
      )}
      <span className="text-muted-foreground">{sensor.enabled ? "Enabled" : "Disabled"}</span>
      {(sensor as SensorConfiguration & { lastReading?: string | Date | null }).lastReading && (
        <span className="text-muted-foreground ml-2">
          • Last reading:{" "}
          {formatDistanceToNow(
            new Date((sensor as SensorConfiguration & { lastReading: string | Date }).lastReading),
            { addSuffix: true }
          )}
        </span>
      )}
    </div>
  );
}

interface BundleStepProps {
  equipment: Pick<Equipment, "id" | "name" | "type">;
  wizardState: WizardState;
  setWizardState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
  onBack: () => void;
  "data-testid"?: string;
}

function BundleStep({
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

interface ThresholdStepProps {
  equipment: Equipment;
  wizardState: WizardState;
  onBack: () => void;
  onSuccess?: () => void;
  onClose: () => void;
  "data-testid"?: string;
}

function ThresholdStep({
  equipment,
  wizardState,
  onBack,
  onSuccess,
  onClose,
  "data-testid": dataTestId,
}: ThresholdStepProps) {
  const {
    bundleDetails,
    bundleTemplates,
    isLoading,
    bundleError,
    templatesError,
    isCustomMode,
    handleFinish,
    isPending,
  } = useThresholdStepData(equipment, wizardState, onSuccess, onClose);
  if (isLoading) {
    return (
      <div data-testid={dataTestId}>
        <LoadingState variant="card" />
      </div>
    );
  }
  if (!isCustomMode && (bundleError || !bundleDetails)) {
    return (
      <div data-testid={dataTestId}>
        <ErrorState error={bundleError || new Error("Bundle not found")} />
      </div>
    );
  }
  if (templatesError) {
    return (
      <div data-testid={dataTestId}>
        <ErrorState error={templatesError} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={dataTestId}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Review & Configure Sensors</h3>
        <p className="text-sm text-muted-foreground">
          {isCustomMode ? (
            <>
              Review your custom sensor selection for {equipment.name}. Default thresholds are
              pre-configured and ready to use.
            </>
          ) : (
            <>
              Review the sensors from <strong>{bundleDetails?.name}</strong> that will be configured
              for {equipment.name}. Default thresholds are pre-configured and ready to use.
            </>
          )}
        </p>
      </div>
      {bundleTemplates.length === 0 ? (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            This bundle contains no sensors. Please go back and select a different bundle.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {bundleTemplates.map((template, index) => (
              <Card
                key={template.templateId || index}
                data-testid={`sensor-preview-${template.kind}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{formatSensorType(template.kind)}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {template.unit || "N/A"}
                    </Badge>
                  </div>
                  {template.notes && (
                    <p className="text-sm text-muted-foreground">{template.notes}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Warning Low:</span>
                      <span className="ml-2 font-medium">
                        {String(
                          template.fields?.["warn_low"] ?? template.fields?.["warnLo"] ?? "—"
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Warning High:</span>
                      <span className="ml-2 font-medium">
                        {String(
                          template.fields?.["warn_high"] ??
                            template.fields?.["warnHi"] ??
                            template.fields?.["warn_rms"] ??
                            "—"
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Critical Low:</span>
                      <span className="ml-2 font-medium">
                        {String(
                          template.fields?.["crit_low"] ?? template.fields?.["critLo"] ?? "—"
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Critical High:</span>
                      <span className="ml-2 font-medium">
                        {String(
                          template.fields?.["crit_high"] ??
                            template.fields?.["critHi"] ??
                            template.fields?.["crit_rms"] ??
                            "—"
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Sensors will be configured with the default threshold values from
          the template. You can adjust thresholds later from the sensor management page.
        </AlertDescription>
      </Alert>
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleFinish}
          disabled={bundleTemplates.length === 0 || isPending}
          data-testid="button-finish"
        >
          {isPending ? (
            <>
              <span className="mr-2">Configuring...</span>
            </>
          ) : (
            <>
              Finish Setup
              <CheckCircle2 className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
