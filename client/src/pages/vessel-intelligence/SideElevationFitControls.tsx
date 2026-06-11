import { Loader2, Minus, Plus, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { SectionMapImageTransform } from "@shared/schema-runtime";
import {
  DEFAULT_IMAGE_TRANSFORM,
  IMAGE_OFFSET_MAX,
  IMAGE_OFFSET_MIN,
  IMAGE_OFFSET_STEP,
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_MIN,
  IMAGE_SCALE_STEP,
  clampImageOffset,
  clampImageScale,
  imageTransformsEqual,
} from "./side-elevation-calibration";
import { useUpdateSectionMapCalibration } from "./registry-api";

interface SideElevationFitControlsProps {
  vesselId?: string | undefined;
  mapId?: string | undefined;
  canEditImageTransform: boolean;
  currentImageTransform: SectionMapImageTransform;
  savedImageTransform: SectionMapImageTransform;
  onScaleXChange: (value: number) => void;
  onScaleYChange: (value: number) => void;
  onOffsetXChange: (value: number) => void;
  onOffsetYChange: (value: number) => void;
  onReset: () => void;
}

export function SideElevationFitControls({
  vesselId,
  mapId,
  canEditImageTransform,
  currentImageTransform,
  savedImageTransform,
  onScaleXChange,
  onScaleYChange,
  onOffsetXChange,
  onOffsetYChange,
  onReset,
}: SideElevationFitControlsProps) {
  const updateCalibration = useUpdateSectionMapCalibration();
  const lengthPercent = Math.round(currentImageTransform.scaleX * 100);
  const heightPercent = Math.round(currentImageTransform.scaleY * 100);
  const panXPercent = Math.round(currentImageTransform.offsetX * 100);
  const panYPercent = Math.round(currentImageTransform.offsetY * 100);
  const isBestFit = imageTransformsEqual(currentImageTransform, DEFAULT_IMAGE_TRANSFORM);
  const hasCalibrationChanges = !imageTransformsEqual(currentImageTransform, savedImageTransform);
  const canSaveImageTransform = Boolean(vesselId && mapId && canEditImageTransform);

  const adjustScale = (delta: number) => {
    onScaleXChange(clampImageScale(currentImageTransform.scaleX + delta));
    onScaleYChange(clampImageScale(currentImageTransform.scaleY + delta));
  };
  const saveImageTransform = () => {
    if (!vesselId || !mapId) {
      return;
    }
    updateCalibration.mutate({
      vesselId,
      mapId,
      imageTransform: currentImageTransform,
    });
  };

  return (
    <div
      className="rounded-md border p-3"
      data-testid="side-elevation-fit-controls"
      aria-label="Side elevation image fit controls"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Side elevation fit</p>
          <p className="text-xs text-muted-foreground">
            Best fit by default. Tune length, height, and position against the section overlay.
          </p>
        </div>
        <Badge variant="outline" data-testid="side-elevation-scale-value">
          L {lengthPercent}% / H {heightPercent}% / X {panXPercent}% / Y {panYPercent}%
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => adjustScale(-IMAGE_SCALE_STEP)}
          disabled={
            currentImageTransform.scaleX <= IMAGE_SCALE_MIN &&
            currentImageTransform.scaleY <= IMAGE_SCALE_MIN
          }
          data-testid="button-side-elevation-fit-contract"
        >
          <Minus className="mr-2 h-4 w-4" />
          Contract
        </Button>
        <Slider
          value={[
            Math.round(((currentImageTransform.scaleX + currentImageTransform.scaleY) / 2) * 100),
          ]}
          min={IMAGE_SCALE_MIN * 100}
          max={IMAGE_SCALE_MAX * 100}
          step={IMAGE_SCALE_STEP * 100}
          onValueChange={([value]) => {
            if (value === undefined) {
              return;
            }
            const next = clampImageScale(value / 100);
            onScaleXChange(next);
            onScaleYChange(next);
          }}
          aria-label="Side elevation uniform image scale"
          data-testid="side-elevation-scale-slider"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isBestFit}
          data-testid="button-side-elevation-fit-reset"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Best fit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => adjustScale(IMAGE_SCALE_STEP)}
          disabled={
            currentImageTransform.scaleX >= IMAGE_SCALE_MAX &&
            currentImageTransform.scaleY >= IMAGE_SCALE_MAX
          }
          data-testid="button-side-elevation-fit-expand"
        >
          <Plus className="mr-2 h-4 w-4" />
          Expand
        </Button>
      </div>
      <div className="mt-4 rounded-md border p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Position</p>
          <Badge variant="outline">
            X {panXPercent}% / Y {panYPercent}%
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Left / right</span>
              <span>{panXPercent}%</span>
            </div>
            <Slider
              value={[panXPercent]}
              min={IMAGE_OFFSET_MIN * 100}
              max={IMAGE_OFFSET_MAX * 100}
              step={IMAGE_OFFSET_STEP * 100}
              onValueChange={([value = panXPercent]) =>
                onOffsetXChange(clampImageOffset(value / 100))
              }
              aria-label="Side elevation horizontal position"
              data-testid="side-elevation-pan-x-slider"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Up / down</span>
              <span>{panYPercent}%</span>
            </div>
            <Slider
              value={[panYPercent]}
              min={IMAGE_OFFSET_MIN * 100}
              max={IMAGE_OFFSET_MAX * 100}
              step={IMAGE_OFFSET_STEP * 100}
              onValueChange={([value = panYPercent]) =>
                onOffsetYChange(clampImageOffset(value / 100))
              }
              aria-label="Side elevation vertical position"
              data-testid="side-elevation-pan-y-slider"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Length</p>
            <Badge variant="outline" data-testid="side-elevation-length-value">
              {lengthPercent}%
            </Badge>
          </div>
          <Slider
            value={[lengthPercent]}
            min={IMAGE_SCALE_MIN * 100}
            max={IMAGE_SCALE_MAX * 100}
            step={IMAGE_SCALE_STEP * 100}
            onValueChange={([value = lengthPercent]) =>
              onScaleXChange(clampImageScale(value / 100))
            }
            aria-label="Side elevation length scale"
            data-testid="side-elevation-length-slider"
          />
        </div>
        <div className="rounded-md border p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Height</p>
            <Badge variant="outline" data-testid="side-elevation-height-value">
              {heightPercent}%
            </Badge>
          </div>
          <Slider
            value={[heightPercent]}
            min={IMAGE_SCALE_MIN * 100}
            max={IMAGE_SCALE_MAX * 100}
            step={IMAGE_SCALE_STEP * 100}
            onValueChange={([value = heightPercent]) =>
              onScaleYChange(clampImageScale(value / 100))
            }
            aria-label="Side elevation height scale"
            data-testid="side-elevation-height-slider"
          />
        </div>
      </div>
      {canSaveImageTransform && (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={saveImageTransform}
            disabled={!hasCalibrationChanges || updateCalibration.isPending}
            data-testid="button-save-side-elevation-fit"
          >
            {updateCalibration.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save fit
          </Button>
        </div>
      )}
    </div>
  );
}
