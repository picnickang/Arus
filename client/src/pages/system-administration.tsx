import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Activity,
  FileText,
  RefreshCw,
  Download,
  Beaker,
  History,
  Radio,
  CalendarClock,
} from "lucide-react";
import { PerformanceHealthTab } from "@/components/admin/PerformanceHealthTab";
import { MLTestingToolsTab } from "@/components/admin/MLTestingToolsTab";
import { AuditTrailTab } from "@/components/admin/AuditTrailTab";
import { ConfigAuditLogTab } from "@/components/admin/ConfigAuditLogTab";
import { SchedulingSettingsTab } from "@/components/admin/SchedulingSettingsTab";
import { TelemetryHealthMonitor } from "@/features/telemetry/components/TelemetryHealthMonitor";
import SyncAdmin from "@/components/SyncAdmin";
import { useSystemAdminData } from "@/features/settings";
import { ConfigurationTab } from "./system-administration-configuration-tab";
import { SoftwareUpdatesTab } from "./system-administration-software-updates-tab";

function UpdatesMaintenanceTab() {
  const [updateSubTab, setUpdateSubTab] = useState("software");
  return (
    <div className="space-y-4">
      <Tabs value={updateSubTab} onValueChange={setUpdateSubTab} className="space-y-4">
        <TabsList data-testid="tabs-update-maintenance">
          <TabsTrigger value="software" data-testid="tab-software">
            <Download className="mr-2 h-4 w-4" />
            Software Updates
          </TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">
            <RefreshCw className="mr-2 h-4 w-4" />
            Synchronization
          </TabsTrigger>
        </TabsList>
        <TabsContent value="software" className="space-y-4">
          <SoftwareUpdatesTab />
        </TabsContent>
        <TabsContent value="sync" className="space-y-4">
          <SyncAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MonitoringHealthTab() {
  const [monitoringSubTab, setMonitoringSubTab] = useState("performance");
  return (
    <div className="space-y-4">
      <Tabs value={monitoringSubTab} onValueChange={setMonitoringSubTab} className="space-y-4">
        <TabsList data-testid="tabs-monitoring-health">
          <TabsTrigger value="performance" data-testid="tab-performance">
            <Activity className="mr-2 h-4 w-4" />
            System Performance
          </TabsTrigger>
          <TabsTrigger value="telemetry" data-testid="tab-telemetry">
            <Radio className="mr-2 h-4 w-4" />
            Telemetry Pipeline
          </TabsTrigger>
        </TabsList>
        <TabsContent value="performance" className="space-y-4">
          <PerformanceHealthTab />
        </TabsContent>
        <TabsContent value="telemetry" className="space-y-4">
          <TelemetryHealthMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditComplianceTab() {
  const [auditSubTab, setAuditSubTab] = useState("activity");
  return (
    <div className="space-y-4">
      <Tabs value={auditSubTab} onValueChange={setAuditSubTab} className="space-y-4">
        <TabsList data-testid="tabs-audit-compliance">
          <TabsTrigger value="activity" data-testid="tab-activity-log">
            <FileText className="mr-2 h-4 w-4" />
            Activity Log
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config-changes">
            <History className="mr-2 h-4 w-4" />
            Configuration Changes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="space-y-4">
          <AuditTrailTab />
        </TabsContent>
        <TabsContent value="config" className="space-y-4">
          <ConfigAuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SystemAdministration() {
  const { activeTab, setActiveTab } = useSystemAdminData();

  return (
    <div className="min-h-screen">
      <div className="container mx-auto py-6 space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="w-full overflow-x-auto">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full">
              <TabsTrigger
                value="configuration"
                data-testid="tab-configuration"
                className="whitespace-nowrap"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configuration
              </TabsTrigger>
              <TabsTrigger
                value="scheduling"
                data-testid="tab-scheduling"
                className="whitespace-nowrap"
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Scheduling
              </TabsTrigger>
              <TabsTrigger
                value="updates-maintenance"
                data-testid="tab-updates-maintenance"
                className="whitespace-nowrap"
              >
                <Download className="mr-2 h-4 w-4" />
                Updates & Maintenance
              </TabsTrigger>
              <TabsTrigger
                value="monitoring-health"
                data-testid="tab-monitoring-health"
                className="whitespace-nowrap"
              >
                <Activity className="mr-2 h-4 w-4" />
                Monitoring & Health
              </TabsTrigger>
              <TabsTrigger
                value="audit-compliance"
                data-testid="tab-audit-compliance"
                className="whitespace-nowrap"
              >
                <FileText className="mr-2 h-4 w-4" />
                Audit & Compliance
              </TabsTrigger>
              <TabsTrigger
                value="ml-testing"
                data-testid="tab-ml-testing"
                className="whitespace-nowrap"
              >
                <Beaker className="mr-2 h-4 w-4" />
                ML & Testing Tools
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="configuration" className="space-y-4">
            <ConfigurationTab />
          </TabsContent>
          <TabsContent value="scheduling" className="space-y-4">
            <SchedulingSettingsTab />
          </TabsContent>
          <TabsContent value="updates-maintenance" className="space-y-4">
            <UpdatesMaintenanceTab />
          </TabsContent>
          <TabsContent value="monitoring-health" className="space-y-4">
            <MonitoringHealthTab />
          </TabsContent>
          <TabsContent value="audit-compliance" className="space-y-4">
            <AuditComplianceTab />
          </TabsContent>
          <TabsContent value="ml-testing" className="space-y-4">
            <MLTestingToolsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
