import { Link } from "wouter";
import {
  Book,
  Wrench,
  FileWarning,
  Bell,
  Ship,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  BarChart3,
  FileText,
  CloudSun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useLogsComplianceData } from "@/features/compliance";

const SeverityIcons: Record<string, typeof AlertTriangle> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: CheckCircle2,
};
const SeverityColors: Record<string, string> = {
  critical: "text-red-600 bg-red-100 dark:bg-red-900/30",
  warning: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
  info: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
};

export default function LogsComplianceHub() {
  const {
    vessels,
    findingsLoading,
    selectedVessel,
    setSelectedVessel,
    activeTab,
    setActiveTab,
    todayStr,
    filteredFindings,
    severityCounts,
    recentFindings,
    getVesselName,
  } = useLogsComplianceData();

  return (
    <div className="container mx-auto max-w-7xl">
      <PageHeader title="Logs & Compliance" />
      <div className="px-6 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Select value={selectedVessel} onValueChange={setSelectedVessel}>
              <SelectTrigger className="w-[200px]" data-testid="select-vessel-filter">
                <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels
                  .filter((v) => v.id)
                  .map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Findings</CardTitle>
              <FileWarning className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredFindings.length}</div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {severityCounts.critical > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {severityCounts.critical} critical
                  </Badge>
                )}
                {severityCounts.warning > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  >
                    {severityCounts.warning} warning
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Link href="/logs/deck">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Deck Logbook</CardTitle>
                <Book className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Navigate, weather, watches</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/logs/engine">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Engine Logbook</CardTitle>
                <Wrench className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Engine room operations</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-orange-600">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/notifications">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                <Bell className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Email & alert settings</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-purple-600">
                  Configure <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="findings" data-testid="tab-findings">
              <FileWarning className="h-4 w-4 mr-2" />
              Compliance Findings
            </TabsTrigger>
            <TabsTrigger value="logbooks" data-testid="tab-logbooks">
              <FileText className="h-4 w-4 mr-2" />
              Logbook Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Compliance Status</CardTitle>
                  <CardDescription>Summary of compliance findings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <span className="text-sm">Critical</span>
                      </div>
                      <span className="font-medium">{severityCounts.critical}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                        <span className="text-sm">Warning</span>
                      </div>
                      <span className="font-medium">{severityCounts.warning}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-sm">Info</span>
                      </div>
                      <span className="font-medium">{severityCounts.info}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between font-medium">
                      <span>Total Open</span>
                      <span>{filteredFindings.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Findings</CardTitle>
                  <CardDescription>Latest compliance items needing attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {findingsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : recentFindings.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                      <p className="text-sm text-muted-foreground">No open findings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentFindings.map((finding) => {
                        const SeverityIcon = SeverityIcons[finding.severity] || AlertTriangle;
                        return (
                          <div
                            key={finding.id}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                            data-testid={`finding-${finding.id}`}
                          >
                            <div className={`p-1 rounded ${SeverityColors[finding.severity]}`}>
                              <SeverityIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {finding.ruleName || finding.ruleCode}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Ship className="h-3 w-3" />
                                {getVesselName(finding.vesselId ?? "")}
                                <span>·</span>
                                {finding.logDate}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredFindings.length > 5 && (
                        <Button variant="ghost" size="sm" className="w-full" asChild>
                          <Link href="/compliance/findings">
                            View all {filteredFindings.length} findings
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button variant="outline" className="justify-start h-auto py-4" asChild>
                    <Link href={`/logs/deck?date=${todayStr}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Book className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Today's Deck Log</div>
                          <div className="text-xs text-muted-foreground">Open today's entries</div>
                        </div>
                      </div>
                    </Link>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-4" asChild>
                    <Link href={`/logs/engine?date=${todayStr}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                          <Wrench className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Today's Engine Log</div>
                          <div className="text-xs text-muted-foreground">Open today's entries</div>
                        </div>
                      </div>
                    </Link>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-4" asChild>
                    <Link href="/notifications">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                          <Bell className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Configure Alerts</div>
                          <div className="text-xs text-muted-foreground">
                            Email notification rules
                          </div>
                        </div>
                      </div>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="findings" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Open Compliance Findings</CardTitle>
                  <CardDescription>
                    {filteredFindings.length} finding(s) requiring attention
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/compliance/findings">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {findingsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredFindings.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">No open compliance findings</p>
                    <p className="text-sm text-muted-foreground">All logbooks are in compliance</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFindings.map((finding) => {
                      const SeverityIcon = SeverityIcons[finding.severity] || AlertTriangle;
                      return (
                        <div
                          key={finding.id}
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`compliance-finding-${finding.id}`}
                        >
                          <div className={`p-2 rounded-lg ${SeverityColors[finding.severity]}`}>
                            <SeverityIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {finding.ruleName || finding.ruleCode}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {finding.message}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Ship className="h-3 w-3" />
                                {getVesselName(finding.vesselId ?? "")}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {finding.logDate}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {finding.sourceType}
                              </Badge>
                            </div>
                          </div>
                          <Badge
                            variant={finding.severity === "critical" ? "destructive" : "outline"}
                            className={
                              finding.severity === "warning"
                                ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : ""
                            }
                          >
                            {finding.severity}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logbooks" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Book className="h-5 w-5 text-blue-600" />
                    Deck Logbook
                  </CardTitle>
                  <CardDescription>Bridge navigation and weather records</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Last 7 Days Entries</span>
                      <span className="text-muted-foreground">-</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Unsigned Logs</span>
                      <span className="text-muted-foreground">-</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Completion Rate</span>
                      <span className="text-muted-foreground">-</span>
                    </div>
                  </div>
                  <Separator />
                  <Button className="w-full" asChild>
                    <Link href="/logs/deck">
                      Open Deck Logbook
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-orange-600" />
                    Engine Logbook
                  </CardTitle>
                  <CardDescription>Engine room operations and readings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Last 7 Days Entries</span>
                      <span className="text-muted-foreground">-</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Unsigned Logs</span>
                      <span className="text-muted-foreground">-</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Completion Rate</span>
                      <span className="text-muted-foreground">-</span>
                    </div>
                  </div>
                  <Separator />
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href="/logs/engine">
                      Open Engine Logbook
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CloudSun className="h-5 w-5 text-cyan-600" />
                    StormGeo Weather Integration
                  </CardTitle>
                  <CardDescription>
                    Automatic weather data import for deck logbook auto-fill
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Integration Status</span>
                      <Badge variant="secondary">File Import</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Auto-fill</span>
                      <span className="text-green-600">Enabled</span>
                    </div>
                  </div>
                  <Separator />
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href="/stormgeo-settings">
                      Configure StormGeo
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-purple-600" />
                    Notification Settings
                  </CardTitle>
                  <CardDescription>Email alerts and notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Email Alerts</span>
                      <Badge variant="secondary">Configured</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Compliance Alerts</span>
                      <span className="text-green-600">Enabled</span>
                    </div>
                  </div>
                  <Separator />
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href="/notifications">
                      Configure Notifications
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
