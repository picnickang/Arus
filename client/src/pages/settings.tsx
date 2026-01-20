import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";
import { Settings } from "lucide-react";

interface SettingsPageProps {
  embedded?: boolean;
}

export default function SettingsPage({ embedded }: SettingsPageProps) {
  return (
    <div className={embedded ? "" : "container mx-auto p-6"}>
      {!embedded && (
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">System Settings</h1>
            <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
          </div>
        </div>
      )}
      <SystemSettingsTab />
    </div>
  );
}
