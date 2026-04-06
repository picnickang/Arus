import { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Wrench, 
  Brain, 
  Wifi, 
  WifiOff,
  ChevronRight,
  ChevronDown,
  FileText,
  CheckCircle,
  Settings,
  Search,
  Download,
  Ship,
  Gauge,
  DollarSign,
  BarChart3,
  Home,
  ChevronLeft
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { IntelligenceLayout } from '@/components/intelligence/IntelligenceLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  usePdmDashboard, 
  useAssetDetail, 
  useAcknowledgeRisk, 
  useCreateWorkOrderFromRisk,
  useCostSavingsSummary,
  useEquipmentFinancials,
  useTelemetryTrends,
  useEquipmentTelemetry,
  usePdmFilterOptions,
  ScheduleView
} from '@/features/pdm';
import type { RiskQueueItem, RiskLevel, TelemetryTrend, EvidenceChip, TelemetryReading } from '@/features/pdm';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ReferenceLine
} from 'recharts';

function FleetHealthGauge({ score, change, period }: { score: number; change: number; period: string }) {
  const rotation = (score / 100) * 180 - 90;
  const getColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-24 h-14 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-12 rounded-t-full border-8 border-muted" />
        <div 
          className={`absolute inset-x-0 bottom-0 h-12 rounded-t-full border-8 ${getColor().replace('text-', 'border-')}`}
          style={{ 
            clipPath: `polygon(0% 100%, 0% 0%, ${50 + score/2}% 0%, ${50 + score/2}% 100%)`
          }} 
        />
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-10 bg-foreground origin-bottom rounded-full"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
      </div>
      <div className="text-center mt-1">
        <span className={`text-2xl font-bold ${getColor()}`} data-testid="kpi-health-score">{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <TrendingUp className={`h-3 w-3 ${change >= 0 ? 'text-green-500' : 'text-red-500 rotate-180'}`} />
        <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
          {change > 0 ? '+' : ''}{change}
        </span>
        <span className="text-muted-foreground">{period}</span>
      </div>
    </div>
  );
}

function KpiCardCompact({ 
  title, 
  value, 
  subtitle, 
  badge,
  variant = 'default',
  testId
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  badge?: { text: string; variant: 'destructive' | 'secondary' | 'outline' };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  testId: string;
}) {
  const bgColor = {
    default: 'bg-primary',
    success: 'bg-green-600 dark:bg-green-700',
    warning: 'bg-yellow-500 dark:bg-yellow-600',
    danger: 'bg-red-600 dark:bg-red-700',
    info: 'bg-blue-600 dark:bg-blue-700',
  }[variant];

  return (
    <div className={`${bgColor} text-white rounded-lg p-3 min-w-[140px] flex-shrink-0`}>
      <p className="text-xs opacity-90 truncate">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-2xl font-bold" data-testid={testId}>{value}</span>
        {badge && (
          <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
            {badge.text}
          </Badge>
        )}
      </div>
      {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: RiskLevel }) {
  const variants: Record<RiskLevel, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    critical: { variant: 'destructive' },
    high: { variant: 'destructive', className: 'bg-orange-500 dark:bg-orange-600' },
    medium: { variant: 'secondary', className: 'bg-yellow-500 text-yellow-950 dark:bg-yellow-600' },
    low: { variant: 'outline', className: 'border-green-500 text-green-600 dark:text-green-400' },
  };
  
  return (
    <Badge {...variants[severity]} className={variants[severity].className}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: 'new' | 'active' | 'acknowledged' | 'resolved' }) {
  const statusLabels: Record<string, string> = {
    new: 'Processing',
    active: 'Processing',
    acknowledged: 'Approved',
    resolved: 'Approved',
  };
  const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; className?: string; icon?: typeof CheckCircle }> = {
    new: { variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    active: { variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    acknowledged: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
    resolved: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  };
  const config = variants[status] || variants.new;
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function MiniSparkline({ data, color = 'hsl(var(--primary))' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 20;
  const width = 60;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

function EvidenceChipBadge({ chip }: { chip: EvidenceChip }) {
  const typeStyles: Record<EvidenceChip['type'], string> = {
    trend: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    threshold: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    anomaly: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    pattern: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };
  
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 ${typeStyles[chip.type]}`}>
      {chip.label}
    </Badge>
  );
}

function RiskQueueDesktopTable({ 
  items, 
  onSelectItem,
  isLoading 
}: { 
  items: RiskQueueItem[];
  onSelectItem: (item: RiskQueueItem) => void;
  isLoading: boolean;
}) {
  const acknowledgeMutation = useAcknowledgeRisk();
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">No items in this queue</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead>Vessel / Asset</TableHead>
            <TableHead>Failure Mode</TableHead>
            <TableHead className="w-[100px]">RUL Estimate</TableHead>
            <TableHead>Recommended Action</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow 
              key={item.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onSelectItem(item)}
              data-testid={`risk-item-${item.id}`}
            >
              <TableCell>
                <SeverityBadge severity={item.severity} />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{item.vesselName}</p>
                  <p className="text-xs text-muted-foreground">{item.equipmentName}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.failureMode}</span>
              </TableCell>
              <TableCell>
                {item.rulEstimateDays !== null ? (
                  <div className="flex flex-col">
                    <span className={`font-semibold text-sm ${item.rulEstimateDays < 7 ? 'text-red-500' : ''}`}>
                      {item.rulEstimateDays < 7 ? '< ' : ''}{item.rulEstimateDays} days
                    </span>
                    {item.rulConfidenceInterval && (
                      <span className="text-xs text-muted-foreground">
                        {item.rulConfidenceInterval.lowDays}-{item.rulConfidenceInterval.highDays}d range
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground block">{item.recommendedAction}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.evidenceChips && item.evidenceChips.length > 0 && (
                      item.evidenceChips.map((chip, idx) => (
                        <EvidenceChipBadge key={idx} chip={chip} />
                      ))
                    )}
                    {item.trendData && item.trendData.length >= 2 && (
                      <MiniSparkline 
                        data={item.trendData} 
                        color={item.severity === 'critical' ? '#ef4444' : item.severity === 'high' ? '#f97316' : '#3b82f6'}
                      />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {item.status !== 'resolved' && (
                    <>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={(e) => { e.stopPropagation(); acknowledgeMutation.mutate(item.id); }}
                        disabled={acknowledgeMutation.isPending}
                        data-testid={`ack-${item.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); createWOMutation.mutate(item.id); }}
                        disabled={createWOMutation.isPending}
                        data-testid={`create-wo-${item.id}`}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RiskQueueMobileCards({ 
  items, 
  onSelectItem,
  isLoading 
}: { 
  items: RiskQueueItem[];
  onSelectItem: (item: RiskQueueItem) => void;
  isLoading: boolean;
}) {
  const acknowledgeMutation = useAcknowledgeRisk();
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">No items in this queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {items.map((item) => (
        <div 
          key={item.id}
          className="p-3 border rounded-lg hover-elevate cursor-pointer"
          onClick={() => onSelectItem(item)}
          data-testid={`risk-item-${item.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <SeverityBadge severity={item.severity} />
                <span className="text-xs text-muted-foreground">{item.vesselName}</span>
              </div>
              <p className="font-medium text-sm truncate">{item.equipmentName}</p>
              <p className="text-xs text-muted-foreground truncate">{item.failureMode}</p>
              {item.evidenceChips && item.evidenceChips.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.evidenceChips.slice(0, 2).map((chip, idx) => (
                    <EvidenceChipBadge key={idx} chip={chip} />
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              {item.rulEstimateDays !== null && (
                <div>
                  <p className={`text-sm font-semibold ${item.rulEstimateDays < 7 ? 'text-red-500' : ''}`}>
                    {item.rulEstimateDays < 7 ? '< ' : ''}{item.rulEstimateDays}d
                  </p>
                  {item.rulConfidenceInterval && (
                    <p className="text-xs text-muted-foreground">
                      {item.rulConfidenceInterval.lowDays}-{item.rulConfidenceInterval.highDays}d
                    </p>
                  )}
                </div>
              )}
              <StatusBadge status={item.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TelemetryCoverageCard({ 
  coverage, 
  isLoading 
}: { 
  coverage?: { onlineCount: number; totalCount: number; delayedCount: number; delayedEquipment: Array<{ equipmentId: string; equipmentName: string; vesselName: string; lastSeenAgo: string }> };
  isLoading: boolean;
}) {
  if (isLoading || !coverage) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Telemetry Coverage
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Telemetry Coverage
          </span>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm">Online:</span>
          <span className="font-bold" data-testid="telemetry-coverage">
            {coverage.onlineCount} / {coverage.totalCount}
          </span>
        </div>
        
        {coverage.delayedCount > 0 && (
          <>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Delayed:</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">{coverage.delayedCount}</span>
            </div>
            <div className="space-y-1 pl-6">
              {coverage.delayedEquipment.slice(0, 3).map((eq) => (
                <div key={eq.equipmentId} className="text-xs flex items-center gap-2">
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate flex-1">{eq.vesselName}</span>
                  <span className="text-muted-foreground shrink-0">Last seen: {eq.lastSeenAgo}</span>
                </div>
              ))}
            </div>
          </>
        )}
        
        <Button variant="outline" size="sm" className="w-full mt-2">
          Ingestion Health <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ModelHealthCard({ 
  health, 
  isLoading 
}: { 
  health?: { activeModelsCount: number; driftAlertsCount: number; lastTrainingDate: string | Date | null };
  isLoading: boolean;
}) {
  if (isLoading || !health) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Health
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const lastTrained = health.lastTrainingDate 
    ? new Date(health.lastTrainingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Model Health
          </span>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm">Models Active:</span>
          <span className="font-bold" data-testid="active-models">{health.activeModelsCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${health.driftAlertsCount > 0 ? 'text-red-500' : 'text-green-500'}`} />
          <span className="text-sm">Drift Alerts:</span>
          <span className={`font-bold ${health.driftAlertsCount > 0 ? 'text-red-500' : ''}`}>{health.driftAlertsCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Last Training:</span>
          <span className="text-sm text-muted-foreground">{lastTrained}</span>
        </div>
        
        <Button variant="outline" size="sm" className="w-full mt-2">
          Model Dashboard <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function MaintenancePipelineCard({ 
  pipeline, 
  isLoading 
}: { 
  pipeline?: { openWorkOrdersCount: number; awaitingApprovalCount: number; inProgressCount: number };
  isLoading: boolean;
}) {
  if (isLoading || !pipeline) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Open Work Orders:</span>
          </div>
          <span className="font-bold" data-testid="open-wo">{pipeline.openWorkOrdersCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">Awaiting Approval:</span>
          </div>
          <span className="font-bold">{pipeline.awaitingApprovalCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-red-500" />
            <span className="text-sm">In Progress:</span>
          </div>
          <span className="font-bold">{pipeline.inProgressCount}</span>
        </div>
        
        <Button variant="outline" size="sm" className="w-full mt-2">
          View WOs <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

function RecommendedActionsChecklist({ actions }: { actions: string[] }) {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  
  const toggleItem = (index: number) => {
    setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };
  
  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Recommended Actions</p>
        <Badge variant="outline" className="text-xs">
          {completedCount}/{actions.length} completed
        </Badge>
      </div>
      <ul className="space-y-2">
        {actions.map((action, i) => (
          <li 
            key={i} 
            className={`flex items-start gap-2 text-sm p-2 rounded cursor-pointer hover-elevate ${
              checkedItems[i] ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted/30'
            }`}
            onClick={() => toggleItem(i)}
            data-testid={`action-item-${i}`}
          >
            <div className={`h-4 w-4 mt-0.5 shrink-0 rounded border flex items-center justify-center ${
              checkedItems[i] 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-muted-foreground'
            }`}>
              {checkedItems[i] && <CheckCircle className="h-3 w-3" />}
            </div>
            <span className={checkedItems[i] ? 'line-through text-muted-foreground' : ''}>
              {action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceTimeSeriesChart({ 
  readings, 
  isLoading, 
  failureMode 
}: { 
  readings?: TelemetryReading[]; 
  isLoading: boolean;
  failureMode: string;
}) {
  if (isLoading) {
    return <Skeleton className="h-[180px] w-full" />;
  }

  if (!readings || readings.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm border rounded-lg bg-muted/30">
        No telemetry data available for this asset
      </div>
    );
  }

  const isVibration = failureMode.toLowerCase().includes('vibration') || failureMode.toLowerCase().includes('bearing');
  const isTemperature = failureMode.toLowerCase().includes('temperature') || failureMode.toLowerCase().includes('overheating');
  
  const threshold = isVibration ? 2.5 : isTemperature ? 85 : null;
  const warningThreshold = isVibration ? 2.0 : isTemperature ? 75 : null;

  const chartData = readings.slice(0, 50).map((r, idx) => ({
    time: new Date(r.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(r.value * 100) / 100,
    sensor: r.sensorType,
  })).reverse();

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Sensor: {readings[0]?.sensorType || 'Unknown'} | Last {readings.length} readings
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 9 }} 
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 10 }} 
            className="text-muted-foreground"
            width={40}
          />
          <Tooltip 
            formatter={(value: number) => [value.toFixed(2), 'Value']}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          {threshold && (
            <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Critical', position: 'right', fontSize: 10, fill: '#ef4444' }} />
          )}
          {warningThreshold && (
            <ReferenceLine y={warningThreshold} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warning', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
          )}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="hsl(210, 70%, 50%)" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssetDetailPanel({ 
  item, 
  onClose 
}: { 
  item: RiskQueueItem | null; 
  onClose: () => void;
}) {
  const { data: assetDetail, isLoading } = useAssetDetail(item?.equipmentId || null);
  const { data: telemetryReadings, isLoading: telemetryLoading } = useEquipmentTelemetry(item?.equipmentId || null, { limit: 50, hours: 24 });
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (!item) return null;

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {item.vesselName} | {item.equipmentName}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={item.severity} />
            <Badge variant="outline">{item.equipmentType}</Badge>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2 text-center">RUL Estimate</p>
            <RulGauge 
              rulDays={item.rulEstimateDays} 
              confidence={item.confidence}
              confidenceInterval={item.rulConfidenceInterval}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">Failure Mode</p>
              <p className="font-medium text-sm mt-1">{item.failureMode}</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="font-bold text-lg">{item.confidence}%</p>
            </div>
          </div>

          {item.evidenceChips && item.evidenceChips.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Evidence</p>
              <div className="flex flex-wrap gap-2">
                {item.evidenceChips.map((chip, idx) => (
                  <EvidenceChipBadge key={idx} chip={chip} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Telemetry History</p>
            <EvidenceTimeSeriesChart 
              readings={telemetryReadings} 
              isLoading={telemetryLoading}
              failureMode={item.failureMode}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : assetDetail?.recommendedActions && (
            <RecommendedActionsChecklist actions={assetDetail.recommendedActions} />
          )}

          <div className="pt-4 border-t space-y-2">
            <Button 
              className="w-full" 
              onClick={() => createWOMutation.mutate(item.id)}
              disabled={createWOMutation.isPending || item.status === 'resolved'}
              data-testid="detail-create-wo"
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Work Order
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RulGauge({ rulDays, confidence, confidenceInterval }: { 
  rulDays: number | null; 
  confidence: number;
  confidenceInterval?: { lowDays: number; highDays: number } | null;
}) {
  if (rulDays === null) {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">RUL data not available</p>
      </div>
    );
  }

  const maxDays = 60;
  const normalizedRul = Math.min(rulDays / maxDays, 1);
  const getColor = (days: number) => {
    if (days < 7) return '#ef4444';
    if (days < 14) return '#f97316';
    if (days < 30) return '#eab308';
    return '#22c55e';
  };

  const mainColor = getColor(rulDays);
  
  const p90Pct = confidenceInterval ? Math.min(confidenceInterval.highDays / maxDays, 1) * 100 : normalizedRul * 100;
  const p10Pct = confidenceInterval ? Math.min(confidenceInterval.lowDays / maxDays, 1) * 100 : normalizedRul * 100;
  const medianPct = normalizedRul * 100;

  const startAngleBase = 180;
  const endAngleBase = 0;
  const p10Angle = startAngleBase - (p10Pct / 100) * 180;
  const p90Angle = startAngleBase - (p90Pct / 100) * 180;
  const medianAngle = startAngleBase - (medianPct / 100) * 180;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          cx="50%"
          cy="100%"
          innerRadius="55%"
          outerRadius="100%"
          barSize={14}
          data={[{ name: 'Base', value: 100, fill: 'hsl(var(--muted))' }]}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar dataKey="value" cornerRadius={6} />
        </RadialBarChart>
      </ResponsiveContainer>

      {confidenceInterval && (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="55%"
              outerRadius="100%"
              barSize={14}
              data={[{ name: 'P90', value: p90Pct, fill: `${mainColor}25` }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}

      {confidenceInterval && (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="55%"
              outerRadius="100%"
              barSize={14}
              data={[{ name: 'P10', value: p10Pct, fill: 'hsl(var(--muted))' }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="60%"
            outerRadius="95%"
            barSize={8}
            data={[{ name: 'Median', value: medianPct, fill: mainColor }]}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="absolute inset-x-0 bottom-6 text-center">
        <p className="text-2xl font-bold" style={{ color: mainColor }} data-testid="rul-gauge-value">
          {confidenceInterval 
            ? `${confidenceInterval.lowDays}-${confidenceInterval.highDays}`
            : rulDays
          }
        </p>
        <p className="text-xs text-muted-foreground">Days (P10-P90)</p>
      </div>
      
      <div className="flex justify-center gap-4 mt-1">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <p className="text-sm font-semibold">{confidence}%</p>
        </div>
        {confidenceInterval && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Median (P50)</p>
            <p className="text-sm font-semibold">{rulDays}d</p>
          </div>
        )}
      </div>
      
      {confidenceInterval && (
        <div className="flex justify-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: `${mainColor}25` }}></span>
            P10-P90
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: mainColor }}></span>
            Median
          </span>
        </div>
      )}
    </div>
  );
}

function SensorTrendChart({ trends, isLoading, sensorFilter }: { 
  trends?: TelemetryTrend[]; 
  isLoading: boolean;
  sensorFilter?: string;
}) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No sensor data available
      </div>
    );
  }

  const filteredTrends = sensorFilter && trends
    ? trends.filter(t => t.sensorType.toLowerCase().includes(sensorFilter.toLowerCase()))
    : trends;

  const chartData = filteredTrends.slice(0, 10).map((t, i) => ({
    name: t.sensorType.length > 12 ? t.sensorType.slice(0, 12) + '...' : t.sensorType,
    fullName: t.sensorType,
    avg: Math.round(t.avgValue * 10) / 10,
    min: Math.round(t.minValue * 10) / 10,
    max: Math.round(t.maxValue * 10) / 10,
    points: t.dataPoints,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No matching sensor data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fontSize: 10 }} 
          className="text-muted-foreground"
          width={70}
        />
        <Tooltip 
          formatter={(value: number, name: string) => [value.toFixed(1), name === 'avg' ? 'Average' : name === 'max' ? 'Maximum' : 'Minimum']}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        <Bar dataKey="min" fill="hsl(210, 70%, 60%)" name="Min" stackId="range" />
        <Bar dataKey="avg" fill="hsl(142, 70%, 45%)" name="Avg" />
        <Bar dataKey="max" fill="hsl(25, 95%, 53%)" name="Max" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SensorTimeSeriesChart({ trends, isLoading }: { trends?: TelemetryTrend[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No sensor trend data available
      </div>
    );
  }

  const vibrationTrends = trends.filter(t => 
    t.sensorType.toLowerCase().includes('vibration') || 
    t.sensorType.toLowerCase().includes('rms') ||
    t.sensorType.toLowerCase().includes('temp')
  ).slice(0, 6);

  const chartData = vibrationTrends.map((t, i) => ({
    sensor: t.sensorType.length > 15 ? t.sensorType.slice(0, 15) + '...' : t.sensorType,
    value: Math.round(t.avgValue * 100) / 100,
    min: Math.round(t.minValue * 100) / 100,
    max: Math.round(t.maxValue * 100) / 100,
    dataPoints: t.dataPoints,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No vibration/temperature data
      </div>
    );
  }

  const hasVibration = trends.some(t => 
    t.sensorType.toLowerCase().includes('vibration') || t.sensorType.toLowerCase().includes('rms')
  );
  const hasTemp = trends.some(t => t.sensorType.toLowerCase().includes('temp'));
  
  const vibrationCritical = hasVibration ? 2.5 : null;
  const vibrationWarning = hasVibration ? 2.0 : null;
  const tempCritical = hasTemp ? 85 : null;
  const tempWarning = hasTemp ? 75 : null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sensorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="sensor" 
          tick={{ fontSize: 10 }} 
          className="text-muted-foreground"
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis 
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <Tooltip 
          formatter={(value: number, name: string) => [value.toFixed(2), name === 'value' ? 'Average' : name]}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        {vibrationCritical !== null && (
          <ReferenceLine y={vibrationCritical} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Vib Critical', position: 'right', fontSize: 9, fill: '#ef4444' }} />
        )}
        {vibrationWarning !== null && (
          <ReferenceLine y={vibrationWarning} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Vib Warning', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
        )}
        {tempCritical !== null && (
          <ReferenceLine y={tempCritical} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'Temp Critical', position: 'right', fontSize: 9, fill: '#dc2626' }} />
        )}
        {tempWarning !== null && (
          <ReferenceLine y={tempWarning} stroke="#ea580c" strokeDasharray="3 3" label={{ value: 'Temp Warning', position: 'right', fontSize: 9, fill: '#ea580c' }} />
        )}
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="hsl(210, 70%, 50%)" 
          fill="url(#sensorGradient)" 
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type MainView = 'risk-queue' | 'schedule';

export default function PdmDashboard() {
  const [, setLocation] = useLocation();
  const [mainView, setMainView] = useState<MainView>('risk-queue');
  const [activeTab, setActiveTab] = useState<'active' | 'new' | 'resolved'>('active');
  const [selectedItem, setSelectedItem] = useState<RiskQueueItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  
  const { data: filterOptions } = usePdmFilterOptions();

  const getDateRange = (days: string) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - parseInt(days));
    return {
      dateFrom: from.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    };
  };

  const dateFilters = getDateRange(dateRange);
  
  const filters = {
    vesselId: fleetFilter !== 'all' ? fleetFilter : undefined,
    equipmentType: equipmentTypeFilter !== 'all' ? equipmentTypeFilter : undefined,
    search: debouncedSearch || undefined,
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
  };

  const { data, isLoading, error } = usePdmDashboard(filters);
  const { data: costSummary, isLoading: costLoading } = useCostSavingsSummary(12);
  const { data: financials, isLoading: financialsLoading } = useEquipmentFinancials();
  const { data: telemetryTrends, isLoading: telemetryLoading } = useTelemetryTrends(undefined, 24);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  useEffect(() => {
    return () => clearTimeout(searchTimeoutRef.current);
  }, []);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (filters.vesselId) params.set('vesselId', filters.vesselId);
    if (filters.equipmentType) params.set('equipmentType', filters.equipmentType);
    if (filters.search) params.set('search', filters.search);
    window.open(`/api/pdm/export/risk-queue?${params.toString()}`, '_blank');
  };

  const handleExportJSON = () => {
    const params = new URLSearchParams();
    params.set('format', 'json');
    if (filters.vesselId) params.set('vesselId', filters.vesselId);
    if (filters.equipmentType) params.set('equipmentType', filters.equipmentType);
    if (filters.search) params.set('search', filters.search);
    window.open(`/api/pdm/export/risk-queue?${params.toString()}`, '_blank');
  };

  if (error) {
    return (
      <IntelligenceLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">Failed to load PdM Dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">Please check your connection and try again</p>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  const currentItems = data?.riskQueue[activeTab] || [];

  return (
    <IntelligenceLayout>
      <div className="bg-[#080e1a]">
      <header className="bg-slate-800 dark:bg-slate-900 text-white">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              
              <div className="hidden md:flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
                <Button
                  variant={mainView === 'risk-queue' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMainView('risk-queue')}
                  className={mainView === 'risk-queue' ? 'bg-slate-600' : 'text-slate-300 hover:text-white'}
                  data-testid="nav-risk-queue"
                >
                  Risk Queue
                </Button>
                <Button
                  variant={mainView === 'schedule' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMainView('schedule')}
                  className={mainView === 'schedule' ? 'bg-slate-600' : 'text-slate-300 hover:text-white'}
                  data-testid="nav-schedule"
                >
                  Schedule
                </Button>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-3 flex-1 justify-end">
              <Select value={fleetFilter} onValueChange={setFleetFilter}>
                <SelectTrigger className="w-[160px] bg-slate-700 border-slate-600 text-white" data-testid="filter-fleet">
                  <Ship className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Fleet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ships</SelectItem>
                  {filterOptions?.vessels.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}>
                <SelectTrigger className="w-[160px] bg-slate-700 border-slate-600 text-white" data-testid="filter-equipment">
                  <Settings className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {filterOptions?.equipmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[160px] bg-slate-700 border-slate-600 text-white" data-testid="filter-date">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  type="search"
                  placeholder="Search asset or tag..."
                  className="w-[200px] pl-8 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-600 text-slate-200"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-slate-700" data-testid="button-search-mobile">
                <Search className="h-5 w-5 md:hidden" />
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-slate-700" data-testid="button-export">
                <Download className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-slate-700" data-testid="button-settings">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex lg:hidden items-center gap-2 mt-3 overflow-x-auto pb-1">
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-md p-0.5 md:hidden">
              <Button
                variant={mainView === 'risk-queue' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMainView('risk-queue')}
                className={`text-xs h-7 ${mainView === 'risk-queue' ? 'bg-slate-600' : 'text-slate-300'}`}
                data-testid="nav-risk-queue-mobile"
              >
                Risk Queue
              </Button>
              <Button
                variant={mainView === 'schedule' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMainView('schedule')}
                className={`text-xs h-7 ${mainView === 'schedule' ? 'bg-slate-600' : 'text-slate-300'}`}
                data-testid="nav-schedule-mobile"
              >
                Schedule
              </Button>
            </div>
            <Select value={fleetFilter} onValueChange={setFleetFilter}>
              <SelectTrigger className="w-[130px] bg-slate-700 border-slate-600 text-white text-xs" data-testid="filter-fleet-mobile">
                <Ship className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ships</SelectItem>
                {filterOptions?.vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}>
              <SelectTrigger className="w-[130px] bg-slate-700 border-slate-600 text-white text-xs" data-testid="filter-equipment-mobile">
                <Settings className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {filterOptions?.equipmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      
      {mainView === 'schedule' ? (
        <div className="p-4 lg:p-6">
          <ScheduleView />
        </div>
      ) : (
      <>
      <div className="p-4 lg:p-6 space-y-6">
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            <div className="bg-slate-700 dark:bg-slate-800 text-white rounded-lg p-3 min-w-[180px] flex-shrink-0">
              <p className="text-xs opacity-90">Fleet Health Score</p>
              {isLoading ? (
                <Skeleton className="h-16 w-full bg-slate-600" />
              ) : (
                <FleetHealthGauge 
                  score={data?.kpis.fleetHealthScore || 0} 
                  change={data?.kpis.fleetHealthChange || 0}
                  period={data?.kpis.fleetHealthPeriod || 'last week'}
                />
              )}
            </div>
            
            <KpiCardCompact
              title="Active Alerts"
              value={isLoading ? '-' : data?.kpis.activeAlertsTotal || 0}
              badge={data?.kpis.criticalAlertsCount ? { text: `${data.kpis.criticalAlertsCount} Critical`, variant: 'destructive' } : undefined}
              variant="danger"
              testId="kpi-active-alerts"
            />
            
            <KpiCardCompact
              title="Assets at Risk"
              value={isLoading ? '-' : data?.kpis.assetsAtRisk || 0}
              subtitle={`${data?.kpis.assetsRulUnder14Days || 0} RUL < 14 Days`}
              variant="warning"
              testId="kpi-assets-at-risk"
            />
            
            <KpiCardCompact
              title="Avoided Downtime"
              value={isLoading ? '-' : `${data?.kpis.avoidedDowntimeHours || 0} hrs`}
              subtitle={data?.kpis.avoidedDowntimePeriod}
              variant="success"
              testId="kpi-avoided-downtime"
            />
            
            <KpiCardCompact
              title="Maintenance Forecast"
              value={isLoading ? '-' : `$${((data?.kpis.maintenanceForecastCost || 0) / 1000).toFixed(0)}k`}
              subtitle={data?.kpis.maintenanceForecastPeriod}
              variant="info"
              testId="kpi-forecast-cost"
            />
            
            <KpiCardCompact
              title="Total Savings (12mo)"
              value={costLoading ? '-' : `$${((costSummary?.totalSavings || 0) / 1000).toFixed(0)}k`}
              subtitle={`${costSummary?.savingsCount || 0} preventive actions`}
              variant="success"
              testId="kpi-total-savings"
            />
            
            <KpiCardCompact
              title="Asset ROI"
              value={financialsLoading ? '-' : `${(financials?.assetROI || 0).toFixed(1)}%`}
              subtitle="Fleet-wide return"
              variant="default"
              testId="kpi-asset-roi"
            />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    Risk Queue
                  </CardTitle>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <Wifi className="h-4 w-4 mr-1" />
                    Ingestion Health <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'new' | 'resolved')}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="active" data-testid="tab-active">
                      Risk Queue ({data?.riskQueue.active.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="new" data-testid="tab-new">
                      Active Alerts ({data?.riskQueue.new.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="resolved" data-testid="tab-resolved">
                      Resolved ({data?.riskQueue.resolved.length || 0})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="mt-0">
                    <div className="hidden md:block">
                      <RiskQueueDesktopTable 
                        items={data?.riskQueue.active || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                    <div className="md:hidden">
                      <RiskQueueMobileCards 
                        items={data?.riskQueue.active || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="new" className="mt-0">
                    <div className="hidden md:block">
                      <RiskQueueDesktopTable 
                        items={data?.riskQueue.new || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                    <div className="md:hidden">
                      <RiskQueueMobileCards 
                        items={data?.riskQueue.new || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="resolved" className="mt-0">
                    <div className="hidden md:block">
                      <RiskQueueDesktopTable 
                        items={data?.riskQueue.resolved || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                    <div className="md:hidden">
                      <RiskQueueMobileCards 
                        items={data?.riskQueue.resolved || []} 
                        onSelectItem={setSelectedItem}
                        isLoading={isLoading}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <TelemetryCoverageCard 
              coverage={data?.telemetryCoverage} 
              isLoading={isLoading}
            />
            <ModelHealthCard 
              health={data?.modelHealth} 
              isLoading={isLoading}
            />
            <MaintenancePipelineCard 
              pipeline={data?.maintenancePipeline} 
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Sensor Overview (Min/Avg/Max)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SensorTrendChart 
                trends={telemetryTrends} 
                isLoading={telemetryLoading} 
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Vibration & Temperature Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SensorTimeSeriesChart 
                trends={telemetryTrends} 
                isLoading={telemetryLoading} 
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AssetDetailPanel 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
      </>
      )}
      </div>
    </IntelligenceLayout>
  );
}
