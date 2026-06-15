import { useStormGeoSettingsData } from "@/features/settings";
import { StormGeoImportHistory } from "./stormgeo-import-history";
import { StormGeoSettingsForm } from "./stormgeo-settings-form";

interface StormGeoSettingsPanelProps {
  vesselId?: string;
}

export function StormGeoSettingsPanel({ vesselId }: StormGeoSettingsPanelProps) {
  const model = useStormGeoSettingsData(vesselId);

  return (
    <div className="space-y-6">
      <StormGeoSettingsForm model={model} />
      <StormGeoImportHistory model={model} />
    </div>
  );
}
