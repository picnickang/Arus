/**
 * BundlePreview component
 * Displays a preview of a selected sensor bundle
 * Extracted to eliminate inline IIFE (S2004)
 */

import { Layers } from "lucide-react";

interface SensorBundle {
  bundleId: string;
  name: string;
  description?: string | null;
  templateIds: string[];
  isSystemDefault?: boolean;
}

interface BundlePreviewProps {
  bundles: SensorBundle[];
  selectedBundleId: string;
}

export function BundlePreview({ bundles, selectedBundleId }: BundlePreviewProps) {
  const bundle = bundles.find((b) => b.bundleId === selectedBundleId);
  
  if (!bundle) {
    return null;
  }

  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{bundle.name}</span>
        </div>
        
        {bundle.description && (
          <p className="text-xs text-muted-foreground">{bundle.description}</p>
        )}
        
        <div className="text-xs text-muted-foreground">
          Will deploy <strong>{bundle.templateIds.length}</strong> sensor configuration(s)
        </div>
        
        <div className="text-xs text-yellow-600">
          Note: Sensors with duplicate types will be skipped
        </div>
      </div>
    </div>
  );
}
