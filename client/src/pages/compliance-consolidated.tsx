import { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCheck, Shield } from "lucide-react";

const LogsComplianceHub = lazy(() => import("./logs-compliance-hub"));
const GovernanceDashboard = lazy(() => import("./governance-dashboard"));

const Loading = () => <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>;

export default function ComplianceConsolidated() {
  const [tab, setTab] = useState("compliance");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="compliance" data-testid="tab-compliance-findings"><FileCheck className="h-4 w-4 mr-2" />Compliance</TabsTrigger>
        <TabsTrigger value="governance" data-testid="tab-governance"><Shield className="h-4 w-4 mr-2" />Governance</TabsTrigger>
      </TabsList>
      <TabsContent value="compliance">
        <Suspense fallback={<Loading />}><LogsComplianceHub /></Suspense>
      </TabsContent>
      <TabsContent value="governance">
        <Suspense fallback={<Loading />}><GovernanceDashboard /></Suspense>
      </TabsContent>
    </Tabs>
  );
}
