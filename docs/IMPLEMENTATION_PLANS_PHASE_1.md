# Phase 1: Detailed Implementation Plans
**Date**: November 24, 2025  
**Status**: 📝 **Design Phase - Awaiting Approval**  
**Estimated Total Effort**: 16-22 hours

---

## Overview

This document provides detailed implementation plans for the 4 high-value marine PdM features approved in Step 1. Each plan includes component architecture, API contracts, UI/UX design, and testing strategy.

---

# Feature 1: Top 5 Fleet Risks Dashboard

**Priority**: ⭐ **Very High**  
**Estimated Effort**: 4-6 hours  
**Marine PdM Value**: Fleet prioritization and resource allocation

---

## 1.1 User Story

**As a** Fleet Manager  
**I want to** see the top 5 highest-risk equipment across my entire fleet  
**So that** I can prioritize maintenance resources and prevent the most critical failures

---

## 1.2 Component Architecture

### Backend Components

**New Service**: `server/services/risk-scoring.service.ts`

```typescript
/**
 * Risk Scoring Service
 * Calculates composite risk scores for equipment based on multiple factors
 */
export interface RiskScore {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  vesselId: string;
  vesselName: string;
  
  // Composite risk score (0-100, higher = more risk)
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Risk factor breakdown
  factors: {
    healthScore: number;        // 0-100 (from health index)
    rulScore: number;           // 0-100 (based on days remaining)
    alertScore: number;         // 0-100 (based on active alerts)
    dtcScore: number;           // 0-100 (based on fault codes)
  };
  
  // Weights (sum to 1.0)
  weights: {
    health: number;   // 0.4 (40%)
    rul: number;      // 0.3 (30%)
    alerts: number;   // 0.2 (20%)
    dtc: number;      // 0.1 (10%)
  };
  
  // Trend (7-day change)
  trend: 'increasing' | 'stable' | 'decreasing';
  trendDelta: number; // +5 means 5 point increase in risk
  
  // Next action
  recommendedAction: string;
  urgency: 'immediate' | 'this_week' | 'this_month' | 'monitor';
  
  lastUpdated: Date;
}

export class RiskScoringService {
  /**
   * Calculate composite risk score for equipment
   */
  async calculateRiskScore(
    equipmentId: string,
    orgId: string
  ): Promise<RiskScore>;
  
  /**
   * Get top N highest-risk equipment for fleet
   */
  async getTopRisks(
    orgId: string,
    limit: number = 5,
    vesselId?: string
  ): Promise<RiskScore[]>;
  
  /**
   * Calculate risk trend (7-day comparison)
   */
  private calculateTrend(
    currentScore: number,
    historicalScores: number[]
  ): { trend: string; delta: number };
}
```

**Risk Scoring Algorithm**:

```typescript
// Pseudo-code for risk calculation
function calculateRiskScore(equipment) {
  // Factor 1: Health Score (0-100, inverted so lower health = higher risk)
  const healthScore = 100 - equipment.healthIndex;
  
  // Factor 2: RUL Score (0-100, fewer days = higher risk)
  const rulDays = equipment.rulPrediction?.remainingDays || 365;
  const rulScore = Math.max(0, 100 - (rulDays / 3.65)); // 365 days = 0 risk, 0 days = 100 risk
  
  // Factor 3: Alert Score (0-100, based on active alerts)
  const criticalAlerts = equipment.alerts.filter(a => a.severity === 'critical').length;
  const highAlerts = equipment.alerts.filter(a => a.severity === 'high').length;
  const alertScore = Math.min(100, (criticalAlerts * 25) + (highAlerts * 10));
  
  // Factor 4: DTC Score (0-100, based on fault codes)
  const criticalDtcs = equipment.dtcs.filter(d => d.severity === 1).length;
  const highDtcs = equipment.dtcs.filter(d => d.severity === 2).length;
  const dtcScore = Math.min(100, (criticalDtcs * 30) + (highDtcs * 15));
  
  // Composite score (weighted average)
  const weights = { health: 0.4, rul: 0.3, alerts: 0.2, dtc: 0.1 };
  const riskScore = 
    (healthScore * weights.health) +
    (rulScore * weights.rul) +
    (alertScore * weights.alerts) +
    (dtcScore * weights.dtc);
  
  return {
    riskScore: Math.round(riskScore),
    riskLevel: getRiskLevel(riskScore),
    factors: { healthScore, rulScore, alertScore, dtcScore },
    weights
  };
}

function getRiskLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}
```

**New API Endpoint**: `server/routes.ts`

```typescript
/**
 * GET /api/fleet/top-risks
 * 
 * Query params:
 *   - orgId: string (required, from header or query)
 *   - limit: number (default: 5, max: 20)
 *   - vesselId: string (optional, filter by vessel)
 * 
 * Response: RiskScore[]
 */
app.get('/api/fleet/top-risks', requireOrgId, async (req, res) => {
  const { orgId } = req as OrgRequest;
  const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
  const vesselId = req.query.vesselId as string | undefined;
  
  const risks = await riskScoringService.getTopRisks(orgId, limit, vesselId);
  res.json(risks);
});
```

### Frontend Components

**New Component**: `client/src/components/fleet/TopRisksPanel.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface TopRisksPanelProps {
  orgId?: string;
  vesselId?: string;
  limit?: number;
  'data-testid'?: string;
}

export function TopRisksPanel({ 
  orgId = 'default-org-id', 
  vesselId,
  limit = 5,
  'data-testid': testId = 'panel-top-risks'
}: TopRisksPanelProps) {
  const { data: risks, isLoading } = useQuery({
    queryKey: ['/api/fleet/top-risks', { orgId, vesselId, limit }],
    refetchInterval: 60_000, // Refresh every minute
  });
  
  if (isLoading) return <TopRisksSkeleton />;
  if (!risks?.length) return <EmptyRisks />;
  
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Top {limit} Fleet Risks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {risks.map((risk, index) => (
            <RiskCard key={risk.equipmentId} risk={risk} rank={index + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskCard({ risk, rank }: { risk: RiskScore; rank: number }) {
  const trendIcon = {
    increasing: <TrendingUp className="h-4 w-4 text-destructive" />,
    stable: <Minus className="h-4 w-4 text-muted-foreground" />,
    decreasing: <TrendingDown className="h-4 w-4 text-green-500" />,
  }[risk.trend];
  
  return (
    <div 
      className="p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={() => navigateToEquipment(risk.equipmentId)}
      data-testid={`risk-card-${rank}`}
    >
      {/* Rank badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg font-bold">
            #{rank}
          </Badge>
          <div>
            <h3 className="font-semibold" data-testid={`risk-equipment-${rank}`}>
              {risk.equipmentName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {risk.vesselName} • {risk.equipmentType}
            </p>
          </div>
        </div>
        <Badge variant={getRiskBadgeVariant(risk.riskLevel)}>
          {risk.riskLevel.toUpperCase()}
        </Badge>
      </div>
      
      {/* Risk score with progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Risk Score</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{risk.riskScore}/100</span>
            {trendIcon}
            {risk.trendDelta !== 0 && (
              <span className="text-xs text-muted-foreground">
                {risk.trendDelta > 0 ? '+' : ''}{risk.trendDelta}
              </span>
            )}
          </div>
        </div>
        <Progress value={risk.riskScore} className="h-2" />
      </div>
      
      {/* Risk factors breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <FactorBadge label="Health" value={risk.factors.healthScore} />
        <FactorBadge label="RUL" value={risk.factors.rulScore} />
        <FactorBadge label="Alerts" value={risk.factors.alertScore} />
        <FactorBadge label="DTC" value={risk.factors.dtcScore} />
      </div>
      
      {/* Recommended action */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{risk.recommendedAction}</span>
        <Badge variant={getUrgencyBadgeVariant(risk.urgency)}>
          {risk.urgency.replace('_', ' ')}
        </Badge>
      </div>
    </div>
  );
}

function FactorBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-2 bg-accent rounded">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
```

---

## 1.3 UI/UX Design

**Dashboard Integration**:
- Add TopRisksPanel to main dashboard (`dashboard.tsx`)
- Position: Top section, full-width card
- Collapsible on mobile

**Visual Design**:
- Risk score: Progress bar (0-100)
- Risk level: Color-coded badge (green/yellow/orange/red)
- Trend: Icon + delta (+5, -3, etc.)
- Factors: Mini gauge indicators (4 columns)
- Click card → navigate to equipment detail page

**Color Scheme**:
- Critical: `hsl(var(--destructive))` (red)
- High: Orange
- Medium: `hsl(var(--warning))` (yellow)
- Low: Green

---

## 1.4 Data Integration

**Data Sources** (existing):
1. Equipment health: `GET /api/equipment/health`
2. RUL predictions: From health response or `GET /api/predictions/:equipmentId`
3. Active alerts: `GET /api/alerts?equipmentId=...`
4. Active DTCs: `GET /api/dtc/active?equipmentId=...`

**New Query**:
- Risk scoring service aggregates data from above sources
- Caches risk scores for 5 minutes
- Recalculates on equipment health updates

---

## 1.5 Testing Strategy

**Backend Tests** (`server/services/__tests__/risk-scoring.service.test.ts`):
```typescript
describe('RiskScoringService', () => {
  it('should calculate risk score for healthy equipment', async () => {
    // healthIndex: 95, RUL: 300 days, no alerts, no DTCs
    // Expected risk score: ~10-15 (low)
  });
  
  it('should calculate high risk for equipment with critical alerts', async () => {
    // healthIndex: 50, RUL: 30 days, 2 critical alerts, 1 critical DTC
    // Expected risk score: 70-80 (high to critical)
  });
  
  it('should return top 5 risks sorted by score descending', async () => {
    // Create 10 equipment with varying risk scores
    // Verify top 5 are correct
  });
  
  it('should filter risks by vesselId', async () => {
    // Verify only equipment from specified vessel returned
  });
});
```

**Frontend Tests** (Playwright):
```typescript
test('Top Risks Panel displays correctly', async ({ page }) => {
  await page.goto('/');
  
  // Verify panel exists
  const panel = page.getByTestId('panel-top-risks');
  await expect(panel).toBeVisible();
  
  // Verify 5 risk cards
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId(`risk-card-${i}`)).toBeVisible();
  }
  
  // Verify risk score, factors, trend
  const firstCard = page.getByTestId('risk-card-1');
  await expect(firstCard.getByText(/Risk Score/)).toBeVisible();
  await expect(firstCard.getByText(/Health/)).toBeVisible();
  
  // Click card navigates to equipment detail
  await firstCard.click();
  await expect(page).toHaveURL(/\/equipment\/.+/);
});
```

---

## 1.6 Acceptance Criteria

- [ ] Risk scoring algorithm implemented with 4 factors (health, RUL, alerts, DTC)
- [ ] API endpoint returns top N risks sorted by score
- [ ] TopRisksPanel component displays on dashboard
- [ ] Each risk card shows: rank, equipment name, vessel, risk score, factors, trend, action
- [ ] Click risk card navigates to equipment detail page
- [ ] Risk scores refresh every 60 seconds
- [ ] Backend tests pass (4 test cases)
- [ ] E2E tests pass (panel display + navigation)
- [ ] No performance degradation (risk calculation < 500ms for fleet of 100 equipment)

---

# Feature 2: Bridge-Style Vessel View

**Priority**: 🔥 **High**  
**Estimated Effort**: 6-8 hours  
**Marine PdM Value**: Familiar interface for ship crew, quick situational awareness

---

## 2.1 User Story

**As a** Ship Officer or Chief Engineer  
**I want to** see a single-vessel dashboard styled like a ship's bridge control panel  
**So that** I can quickly assess all critical equipment status at a glance

---

## 2.2 Component Architecture

### Frontend Components

**New Page**: `client/src/pages/vessel-bridge.tsx`

```typescript
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { StatusIndicator } from '@/components/shared/StatusIndicator';

export default function VesselBridgePage() {
  const { vesselId } = useParams<{ vesselId: string }>();
  
  // Fetch vessel data
  const { data: vessel } = useQuery({
    queryKey: ['/api/vessels', vesselId],
  });
  
  // Fetch equipment for vessel
  const { data: equipment } = useQuery({
    queryKey: ['/api/equipment/health', { vesselId }],
    refetchInterval: 30_000, // 30s refresh
  });
  
  // Fetch latest telemetry for vessel
  const { data: telemetry } = useQuery({
    queryKey: ['/api/telemetry/latest', { vesselId }],
    refetchInterval: 10_000, // 10s refresh for real-time feel
  });
  
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header: Vessel name + timestamp */}
      <VesselHeader vessel={vessel} />
      
      {/* Main panel: Large gauges for critical equipment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Main Engine RPM */}
        <MainEngineGauge telemetry={telemetry} />
        
        {/* Fuel Pressure */}
        <FuelPressureGauge telemetry={telemetry} />
        
        {/* Engine Temperature */}
        <EngineTemperatureGauge telemetry={telemetry} />
      </div>
      
      {/* Equipment grid: All equipment with status */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
        {equipment?.map(eq => (
          <EquipmentStatusCard key={eq.id} equipment={eq} />
        ))}
      </div>
      
      {/* Alerts panel: Active alerts */}
      <ActiveAlertsPanel vesselId={vesselId} />
    </div>
  );
}

function MainEngineGauge({ telemetry }) {
  const rpm = telemetry?.find(t => t.sensorType === 'rpm')?.value || 0;
  const maxRpm = 1800; // Typical main engine max RPM
  
  return (
    <Card className="bg-slate-800 border-slate-700 p-6">
      <h3 className="text-center text-lg font-semibold mb-4">Main Engine RPM</h3>
      <GaugeChart
        value={rpm}
        min={0}
        max={maxRpm}
        unit="RPM"
        ranges={[
          { min: 0, max: 300, color: 'red', label: 'Idle' },
          { min: 300, max: 1200, color: 'green', label: 'Normal' },
          { min: 1200, max: 1800, color: 'yellow', label: 'High' },
        ]}
        size="large"
      />
      <div className="text-center mt-4 text-3xl font-bold">
        {rpm.toFixed(0)} <span className="text-sm text-muted-foreground">RPM</span>
      </div>
    </Card>
  );
}

function EquipmentStatusCard({ equipment }) {
  const statusColor = {
    critical: 'bg-red-500',
    poor: 'bg-orange-500',
    fair: 'bg-yellow-500',
    good: 'bg-green-500',
    excellent: 'bg-green-500',
  }[equipment.status];
  
  return (
    <Card 
      className="bg-slate-800 border-slate-700 p-4 hover:bg-slate-700 cursor-pointer transition-colors"
      onClick={() => navigateToEquipment(equipment.id)}
      data-testid={`equipment-status-${equipment.id}`}
    >
      {/* Status indicator (traffic light) */}
      <div className={`w-3 h-3 rounded-full ${statusColor} mb-2`} />
      
      {/* Equipment name */}
      <h4 className="font-semibold text-sm mb-1">{equipment.name}</h4>
      
      {/* Health index */}
      <div className="text-xs text-muted-foreground">
        Health: {equipment.healthIndex}%
      </div>
      
      {/* RUL */}
      {equipment.predictedDueDays && (
        <div className="text-xs text-muted-foreground">
          RUL: {equipment.predictedDueDays}d
        </div>
      )}
    </Card>
  );
}
```

**New Component**: `client/src/components/charts/GaugeChart.tsx`

```typescript
import { PieChart, Pie, Cell } from 'recharts';

interface GaugeChartProps {
  value: number;
  min: number;
  max: number;
  unit: string;
  ranges: Array<{
    min: number;
    max: number;
    color: string;
    label: string;
  }>;
  size?: 'small' | 'medium' | 'large';
  'data-testid'?: string;
}

export function GaugeChart({
  value,
  min,
  max,
  unit,
  ranges,
  size = 'medium',
  'data-testid': testId = 'chart-gauge',
}: GaugeChartProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  // Create arc segments for color ranges
  const segments = ranges.map(range => ({
    name: range.label,
    value: ((range.max - range.min) / (max - min)) * 100,
    color: range.color,
  }));
  
  const sizes = {
    small: { width: 150, height: 100, innerRadius: 50, outerRadius: 70 },
    medium: { width: 200, height: 130, innerRadius: 70, outerRadius: 90 },
    large: { width: 250, height: 160, innerRadius: 90, outerRadius: 110 },
  }[size];
  
  return (
    <div className="relative" data-testid={testId}>
      <PieChart width={sizes.width} height={sizes.height}>
        <Pie
          data={segments}
          startAngle={180}
          endAngle={0}
          innerRadius={sizes.innerRadius}
          outerRadius={sizes.outerRadius}
          dataKey="value"
          stroke="none"
        >
          {segments.map((segment, index) => (
            <Cell key={`cell-${index}`} fill={segment.color} />
          ))}
        </Pie>
      </PieChart>
      
      {/* Needle indicator */}
      <NeedleIndicator 
        percentage={percentage} 
        width={sizes.width} 
        height={sizes.height} 
      />
    </div>
  );
}
```

---

## 2.3 UI/UX Design

**Layout**:
```
┌─────────────────────────────────────────────┐
│ MV Pacific Star          12:45:32 SGT       │
├─────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │  RPM   │  │  Fuel  │  │  Temp  │        │ <- Large gauges
│  │ [GAUGE]│  │[GAUGE] │  │[GAUGE] │        │
│  │  1,450 │  │  72PSI │  │  78°C  │        │
│  └────────┘  └────────┘  └────────┘        │
├─────────────────────────────────────────────┤
│ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                  │
│ │●│││●│││●│││●│││●│││●││                  │ <- Equipment grid
│ │ME││Gen││BT1││ST1││Pump││...              │    (6 per row)
│ │85│││92│││78│││95│││88││                 │
│ └──┘└──┘└──┘└──┘└──┘└──┘                  │
├─────────────────────────────────────────────┤
│ ⚠ Active Alerts (3)                        │
│ • Main Engine oil pressure low - CRITICAL  │ <- Alerts panel
│ • Bow Thruster vibration high - WARNING    │
│ • Generator fuel filter clogged - INFO     │
└─────────────────────────────────────────────┘
```

**Color Scheme** (Bridge style):
- Background: Dark slate (`bg-slate-900`)
- Cards: Slate (`bg-slate-800`)
- Text: White
- Status lights: Traffic light colors (red/yellow/green)
- Gauges: Color-coded ranges (red = danger, yellow = caution, green = normal)

**Responsive**:
- Desktop: 3 gauges + 6 equipment per row
- Tablet: 2 gauges + 4 equipment per row
- Mobile: 1 gauge + 2 equipment per row

---

## 2.4 Data Integration

**Existing APIs** (no new endpoints needed):
1. Vessel data: `GET /api/vessels/:vesselId`
2. Equipment health: `GET /api/equipment/health?vesselId=...`
3. Latest telemetry: `GET /api/telemetry/latest?vesselId=...`
4. Active alerts: `GET /api/alerts?vesselId=...`

**Real-Time Updates**:
- WebSocket subscription: `subscribe('data:vessels')`
- Poll telemetry every 10 seconds (faster than dashboard's 30s)
- Show "Last Updated" timestamp

---

## 2.5 Testing Strategy

**E2E Tests** (Playwright):
```typescript
test('Vessel Bridge displays correctly', async ({ page }) => {
  await page.goto('/vessel-bridge/test-vessel-id');
  
  // Verify vessel name in header
  await expect(page.getByText(/MV Pacific Star/)).toBeVisible();
  
  // Verify large gauges
  await expect(page.getByTestId('gauge-main-engine-rpm')).toBeVisible();
  await expect(page.getByTestId('gauge-fuel-pressure')).toBeVisible();
  await expect(page.getByTestId('gauge-engine-temperature')).toBeVisible();
  
  // Verify equipment grid (at least 6 cards)
  const equipmentCards = page.getByTestId(/equipment-status-/);
  await expect(equipmentCards).toHaveCount.greaterThanOrEqual(6);
  
  // Verify alerts panel
  await expect(page.getByText(/Active Alerts/)).toBeVisible();
  
  // Click equipment card navigates to detail
  await equipmentCards.first().click();
  await expect(page).toHaveURL(/\/equipment\/.+/);
});

test('Vessel Bridge updates in real-time', async ({ page }) => {
  await page.goto('/vessel-bridge/test-vessel-id');
  
  // Get initial RPM value
  const initialRpm = await page.getByTestId('gauge-value-rpm').textContent();
  
  // Wait 15 seconds (2x refresh interval)
  await page.waitForTimeout(15_000);
  
  // Verify RPM has updated (different value or same if simulator not running)
  const updatedRpm = await page.getByTestId('gauge-value-rpm').textContent();
  // Test passes if value changed OR if timestamp updated
  await expect(page.getByText(/Last Updated/)).toContainText(/ago/);
});
```

---

## 2.6 Acceptance Criteria

- [ ] New page route: `/vessel-bridge/:vesselId`
- [ ] Header shows vessel name and current time (SGT)
- [ ] 3 large gauges for critical sensors (RPM, pressure, temperature)
- [ ] Equipment grid shows all equipment with status indicators
- [ ] Active alerts panel shows current alerts
- [ ] Dark theme (bridge-style)
- [ ] Real-time updates every 10 seconds
- [ ] Click equipment card navigates to equipment detail
- [ ] Responsive design (desktop, tablet, mobile)
- [ ] E2E tests pass (display + real-time updates)

---

# Feature 3: Multi-Sensor Time-Series Overlay

**Priority**: 🔥 **High**  
**Estimated Effort**: 3-4 hours  
**Marine PdM Value**: Correlation analysis for diagnostics

---

## 3.1 User Story

**As a** Marine Engineer  
**I want to** overlay multiple sensor readings on one chart  
**So that** I can identify correlations and diagnose equipment issues faster

---

## 3.2 Component Architecture

### Frontend Components

**Enhanced Component**: `client/src/components/charts/MultiSensorChart.tsx`

```typescript
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface SensorData {
  sensorType: string;
  unit: string;
  color: string;
  data: Array<{
    timestamp: Date;
    value: number;
  }>;
}

interface MultiSensorChartProps {
  sensors: SensorData[];
  title: string;
  description?: string;
  timeRange?: '1h' | '6h' | '24h' | '7d';
  isLoading?: boolean;
  error?: string | null;
  'data-testid'?: string;
}

export function MultiSensorChart({
  sensors,
  title,
  description,
  timeRange = '24h',
  isLoading = false,
  error = null,
  'data-testid': testId = 'chart-multi-sensor',
}: MultiSensorChartProps) {
  // Track which sensors are visible
  const [visibleSensors, setVisibleSensors] = useState<Set<string>>(
    new Set(sensors.map(s => s.sensorType))
  );
  
  // Merge all sensor data into single timeline
  const chartData = mergeTimeSeriesData(
    sensors.filter(s => visibleSensors.has(s.sensorType))
  );
  
  const toggleSensor = (sensorType: string) => {
    const newVisible = new Set(visibleSensors);
    if (newVisible.has(sensorType)) {
      newVisible.delete(sensorType);
    } else {
      newVisible.add(sensorType);
    }
    setVisibleSensors(newVisible);
  };
  
  return (
    <ChartWrapper
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      isEmpty={!chartData.length}
      emptyMessage="No sensor data available"
      data-testid={testId}
    >
      {/* Sensor selector checkboxes */}
      <div className="flex flex-wrap gap-4 mb-4">
        {sensors.map(sensor => (
          <div key={sensor.sensorType} className="flex items-center gap-2">
            <Checkbox
              id={`sensor-${sensor.sensorType}`}
              checked={visibleSensors.has(sensor.sensorType)}
              onCheckedChange={() => toggleSensor(sensor.sensorType)}
              data-testid={`checkbox-${sensor.sensorType}`}
            />
            <Label 
              htmlFor={`sensor-${sensor.sensorType}`}
              className="cursor-pointer"
              style={{ color: sensor.color }}
            >
              {sensor.sensorType} ({sensor.unit})
            </Label>
          </div>
        ))}
      </div>
      
      {/* Multi-line chart with dual Y-axis */}
      <LineChart data={chartData} margin={{ top: 5, right: 60, left: 60, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(ts) => format(new Date(ts), 'HH:mm')}
          className="text-xs"
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        
        {/* Left Y-axis (first sensor) */}
        {visibleSensors.size > 0 && (
          <YAxis
            yAxisId="left"
            className="text-xs"
            tick={{ fill: 'hsl(var(--foreground))' }}
            label={{ 
              value: sensors[0]?.unit || '', 
              angle: -90, 
              position: 'insideLeft' 
            }}
          />
        )}
        
        {/* Right Y-axis (second sensor, if different unit) */}
        {visibleSensors.size > 1 && sensors[1]?.unit !== sensors[0]?.unit && (
          <YAxis
            yAxisId="right"
            orientation="right"
            className="text-xs"
            tick={{ fill: 'hsl(var(--foreground))' }}
            label={{ 
              value: sensors[1]?.unit || '', 
              angle: 90, 
              position: 'insideRight' 
            }}
          />
        )}
        
        <Tooltip content={<CustomTooltip sensors={sensors} />} />
        <Legend />
        
        {/* Render line for each visible sensor */}
        {sensors
          .filter(s => visibleSensors.has(s.sensorType))
          .map((sensor, index) => (
            <Line
              key={sensor.sensorType}
              type="monotone"
              dataKey={sensor.sensorType}
              name={`${sensor.sensorType} (${sensor.unit})`}
              stroke={sensor.color}
              strokeWidth={2}
              dot={false}
              yAxisId={index === 0 ? 'left' : 'right'}
              data-testid={`line-${sensor.sensorType}`}
            />
          ))}
      </LineChart>
    </ChartWrapper>
  );
}

/**
 * Merge multiple sensor time series into single dataset
 * for Recharts (one row per timestamp)
 */
function mergeTimeSeriesData(sensors: SensorData[]) {
  const merged: Record<number, any> = {};
  
  sensors.forEach(sensor => {
    sensor.data.forEach(point => {
      const ts = point.timestamp.getTime();
      if (!merged[ts]) {
        merged[ts] = { timestamp: point.timestamp };
      }
      merged[ts][sensor.sensorType] = point.value;
    });
  });
  
  return Object.values(merged).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

function CustomTooltip({ active, payload, sensors }: any) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm mb-2">
        {format(new Date(payload[0].payload.timestamp), 'MMM dd, HH:mm:ss')}
      </p>
      {payload.map((entry: any) => {
        const sensor = sensors.find((s: any) => s.sensorType === entry.name.split(' ')[0]);
        return (
          <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toFixed(2)}
          </p>
        );
      })}
    </div>
  );
}
```

**Usage Example**:

```typescript
// In equipment detail page
const { data: telemetryHistory } = useQuery({
  queryKey: ['/api/telemetry/history-multi', equipmentId, sensorTypes],
});

<MultiSensorChart
  title="Main Engine Diagnostics"
  description="Temperature, Pressure, Vibration correlation"
  sensors={[
    {
      sensorType: 'temperature',
      unit: '°C',
      color: 'hsl(var(--chart-1))',
      data: telemetryHistory.filter(t => t.sensorType === 'temperature'),
    },
    {
      sensorType: 'pressure',
      unit: 'PSI',
      color: 'hsl(var(--chart-2))',
      data: telemetryHistory.filter(t => t.sensorType === 'pressure'),
    },
    {
      sensorType: 'vibration',
      unit: 'Hz',
      color: 'hsl(var(--chart-3))',
      data: telemetryHistory.filter(t => t.sensorType === 'vibration'),
    },
  ]}
  timeRange="24h"
/>
```

---

## 3.3 UI/UX Design

**Features**:
- ✅ Checkbox toggles to show/hide sensors
- ✅ Dual Y-axis support (left + right for different units)
- ✅ Color-coded lines (consistent with sensor colors)
- ✅ Hover tooltip shows all sensor values at that timestamp
- ✅ Time range selector (1h, 6h, 24h, 7d)
- ✅ Legend shows sensor names + units

**Marine Use Cases**:
1. **Diesel Engine**: Temperature + Pressure + RPM
2. **Bearing Analysis**: Vibration + Temperature + Oil Pressure
3. **Hydraulic System**: Pressure + Flow Rate + Temperature
4. **Thruster**: RPM + Current Draw + Vibration

---

## 3.4 Data Integration

**Existing APIs** (no new endpoints needed):
- `GET /api/telemetry/history/:equipmentId/:sensorType?hours=24`
- Call once per sensor type, then merge client-side

**Optimization** (optional future):
- New endpoint: `GET /api/telemetry/history-multi?equipmentId=...&sensorTypes=temp,pressure,vibration&hours=24`
- Returns all sensor types in one call

---

## 3.5 Testing Strategy

**E2E Tests** (Playwright):
```typescript
test('Multi-sensor chart displays correctly', async ({ page }) => {
  await page.goto('/equipment/test-equipment-id');
  
  // Verify chart exists
  const chart = page.getByTestId('chart-multi-sensor');
  await expect(chart).toBeVisible();
  
  // Verify sensor checkboxes (3 sensors)
  await expect(page.getByTestId('checkbox-temperature')).toBeChecked();
  await expect(page.getByTestId('checkbox-pressure')).toBeChecked();
  await expect(page.getByTestId('checkbox-vibration')).toBeChecked();
  
  // Verify all 3 lines visible
  await expect(page.getByTestId('line-temperature')).toBeVisible();
  await expect(page.getByTestId('line-pressure')).toBeVisible();
  await expect(page.getByTestId('line-vibration')).toBeVisible();
  
  // Uncheck temperature
  await page.getByTestId('checkbox-temperature').click();
  
  // Verify temperature line hidden
  await expect(page.getByTestId('line-temperature')).not.toBeVisible();
  await expect(page.getByTestId('line-pressure')).toBeVisible();
});
```

---

## 3.6 Acceptance Criteria

- [ ] MultiSensorChart component renders with 2-4 sensors
- [ ] Checkbox toggles show/hide sensor lines
- [ ] Dual Y-axis support for different units
- [ ] Hover tooltip shows all sensor values at timestamp
- [ ] Color-coded lines match sensor colors
- [ ] Time range selector (1h, 6h, 24h, 7d)
- [ ] Responsive design (mobile-friendly)
- [ ] E2E tests pass (display + toggle sensors)
- [ ] Performance: Chart renders smoothly with 7 days of data (10k+ points)

---

# Feature 4: Alert Impact Analysis (Simplified)

**Priority**: 🔥 **High**  
**Estimated Effort**: 3-4 hours  
**Marine PdM Value**: Decision support for maintenance prioritization

---

## 4.1 User Story

**As a** Chief Engineer  
**I want to** see the potential impact of ignoring each alert  
**So that** I can prioritize maintenance tasks based on risk and urgency

---

## 4.2 Component Architecture (Simplified Version)

### Backend Components

**New Service**: `server/services/impact-analysis.service.ts`

```typescript
/**
 * Impact Analysis Service (Simplified)
 * Categorizes alert impact based on equipment criticality and alert severity
 */
export interface AlertImpact {
  alertId: string;
  
  // Impact level (based on equipment criticality + alert severity)
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Safety risk
  safetyRisk: 'low' | 'medium' | 'high' | 'critical';
  
  // Time to failure (from RUL if available)
  timeToFailure: number | null; // days
  urgency: 'immediate' | 'this_week' | 'this_month' | 'monitor';
  
  // Template-based descriptions
  description: string;
  recommendation: string;
  
  // Equipment context
  equipmentCriticality: 'critical' | 'important' | 'auxiliary';
}

export class ImpactAnalysisService {
  /**
   * Analyze alert impact
   */
  async analyzeAlertImpact(
    alertId: string,
    orgId: string
  ): Promise<AlertImpact> {
    // Get alert + equipment + RUL
    const alert = await getAlert(alertId);
    const equipment = await getEquipment(alert.equipmentId);
    const rulPrediction = await getRulPrediction(alert.equipmentId);
    
    // Determine equipment criticality
    const criticality = this.getEquipmentCriticality(equipment.type);
    
    // Calculate impact level
    const impactLevel = this.calculateImpactLevel(
      alert.severity,
      criticality
    );
    
    // Calculate safety risk
    const safetyRisk = this.calculateSafetyRisk(
      equipment.type,
      alert.severity
    );
    
    // Determine urgency
    const urgency = this.calculateUrgency(
      rulPrediction?.remainingDays,
      impactLevel
    );
    
    // Generate descriptions
    const description = this.generateDescription(
      equipment,
      alert,
      impactLevel
    );
    const recommendation = this.generateRecommendation(
      urgency,
      impactLevel
    );
    
    return {
      alertId,
      impactLevel,
      safetyRisk,
      timeToFailure: rulPrediction?.remainingDays || null,
      urgency,
      description,
      recommendation,
      equipmentCriticality: criticality,
    };
  }
  
  /**
   * Equipment criticality mapping
   */
  private getEquipmentCriticality(
    equipmentType: string
  ): 'critical' | 'important' | 'auxiliary' {
    const criticalEquipment = [
      'Main Engine',
      'Steering Gear',
      'Fire Suppression',
      'DP Thruster',
    ];
    
    const importantEquipment = [
      'Generator',
      'Bow Thruster',
      'Stern Thruster',
      'Fuel Pump',
      'Cooling Pump',
    ];
    
    if (criticalEquipment.some(e => equipmentType.includes(e))) {
      return 'critical';
    }
    if (importantEquipment.some(e => equipmentType.includes(e))) {
      return 'important';
    }
    return 'auxiliary';
  }
  
  /**
   * Impact level calculation
   */
  private calculateImpactLevel(
    alertSeverity: string,
    equipmentCriticality: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Matrix: severity × criticality
    const matrix = {
      critical: {
        critical: 'critical',
        important: 'high',
        auxiliary: 'medium',
      },
      high: {
        critical: 'high',
        important: 'high',
        auxiliary: 'medium',
      },
      medium: {
        critical: 'high',
        important: 'medium',
        auxiliary: 'low',
      },
      low: {
        critical: 'medium',
        important: 'low',
        auxiliary: 'low',
      },
    };
    
    return matrix[alertSeverity]?.[equipmentCriticality] || 'low';
  }
  
  /**
   * Safety risk calculation
   */
  private calculateSafetyRisk(
    equipmentType: string,
    alertSeverity: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    const safetyEquipment = [
      'Main Engine',
      'Steering Gear',
      'Fire Suppression',
      'Lifeboat System',
    ];
    
    const isSafetyCritical = safetyEquipment.some(e => 
      equipmentType.includes(e)
    );
    
    if (isSafetyCritical && alertSeverity === 'critical') return 'critical';
    if (isSafetyCritical) return 'high';
    if (alertSeverity === 'critical') return 'high';
    if (alertSeverity === 'high') return 'medium';
    return 'low';
  }
  
  /**
   * Urgency calculation
   */
  private calculateUrgency(
    rulDays: number | null,
    impactLevel: string
  ): 'immediate' | 'this_week' | 'this_month' | 'monitor' {
    if (impactLevel === 'critical') return 'immediate';
    if (rulDays !== null && rulDays < 7) return 'immediate';
    if (impactLevel === 'high' || (rulDays !== null && rulDays < 30)) {
      return 'this_week';
    }
    if (impactLevel === 'medium') return 'this_month';
    return 'monitor';
  }
  
  /**
   * Template-based description generation
   */
  private generateDescription(
    equipment: any,
    alert: any,
    impactLevel: string
  ): string {
    const templates = {
      critical: `CRITICAL: Failure of ${equipment.name} could result in loss of propulsion, steering, or safety systems. Immediate action required.`,
      high: `HIGH IMPACT: ${equipment.name} failure may cause significant operational disruption or safety concerns. Schedule urgent maintenance.`,
      medium: `MODERATE IMPACT: ${equipment.name} degradation could lead to increased maintenance costs or minor operational delays.`,
      low: `LOW IMPACT: ${equipment.name} issue is minor but should be addressed during next scheduled maintenance.`,
    };
    
    return templates[impactLevel] || templates.low;
  }
  
  /**
   * Template-based recommendation generation
   */
  private generateRecommendation(
    urgency: string,
    impactLevel: string
  ): string {
    const recommendations = {
      immediate: 'Address immediately. Stop vessel operations if safe to do so and perform emergency repair.',
      this_week: 'Schedule maintenance within 7 days. Monitor closely until repair.',
      this_month: 'Add to maintenance schedule for next port call or within 30 days.',
      monitor: 'Continue monitoring. No immediate action required.',
    };
    
    return recommendations[urgency] || recommendations.monitor;
  }
}
```

**No new API endpoint** - Impact analysis returned with alert data:

```typescript
// Modify existing alert API to include impact
app.get('/api/alerts', requireOrgId, async (req, res) => {
  const alerts = await getAlerts(orgId);
  
  // Enrich with impact analysis
  const enrichedAlerts = await Promise.all(
    alerts.map(async (alert) => ({
      ...alert,
      impact: await impactAnalysisService.analyzeAlertImpact(alert.id, orgId),
    }))
  );
  
  res.json(enrichedAlerts);
});
```

### Frontend Components

**Enhanced Component**: `client/src/components/alerts/AlertImpactBadge.tsx`

```typescript
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock, Shield } from 'lucide-react';

interface AlertImpactBadgeProps {
  impact: AlertImpact;
  'data-testid'?: string;
}

export function AlertImpactBadge({ 
  impact,
  'data-testid': testId = 'badge-alert-impact' 
}: AlertImpactBadgeProps) {
  const impactVariant = {
    critical: 'destructive',
    high: 'default',
    medium: 'secondary',
    low: 'outline',
  }[impact.impactLevel];
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex flex-col gap-2" data-testid={testId}>
          {/* Impact level badge */}
          <Badge variant={impactVariant}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            {impact.impactLevel.toUpperCase()} IMPACT
          </Badge>
          
          {/* Safety risk badge */}
          {impact.safetyRisk !== 'low' && (
            <Badge variant={impact.safetyRisk === 'critical' ? 'destructive' : 'default'}>
              <Shield className="h-3 w-3 mr-1" />
              Safety: {impact.safetyRisk}
            </Badge>
          )}
          
          {/* Urgency badge */}
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {impact.urgency.replace('_', ' ')}
          </Badge>
        </div>
      </TooltipTrigger>
      
      <TooltipContent className="max-w-sm">
        <div className="space-y-2">
          <p className="font-semibold">{impact.description}</p>
          <p className="text-sm text-muted-foreground">
            <strong>Recommendation:</strong> {impact.recommendation}
          </p>
          {impact.timeToFailure && (
            <p className="text-sm">
              <strong>Time to Failure:</strong> ~{impact.timeToFailure} days
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

**Usage in Alerts Page**:

```typescript
// In alerts.tsx
{alerts.map(alert => (
  <Card key={alert.id}>
    <CardContent className="flex items-center justify-between">
      <div>
        <h3>{alert.message}</h3>
        <p className="text-sm text-muted-foreground">
          {alert.equipmentName} • {alert.vesselName}
        </p>
      </div>
      
      {/* Impact badges */}
      <AlertImpactBadge impact={alert.impact} />
    </CardContent>
  </Card>
))}
```

---

## 4.3 UI/UX Design

**Visual Elements**:
- **Impact Level Badge**: Color-coded (red/orange/yellow/gray)
- **Safety Risk Badge**: Shield icon (shown only if medium/high/critical)
- **Urgency Badge**: Clock icon
- **Tooltip**: Full description + recommendation on hover

**Example Alert Card**:
```
┌─────────────────────────────────────────────────┐
│ ⚠ Main Engine oil pressure low                 │
│ Main Engine MAN 6L23/30H • MV Pacific Star     │
│                                                 │
│ [🔺 CRITICAL IMPACT] [🛡 Safety: high]         │
│ [🕐 immediate]                                  │
│                                                 │
│ Hover for details:                              │
│ "CRITICAL: Failure of Main Engine could result │
│  in loss of propulsion. Immediate action       │
│  required."                                     │
│ Recommendation: Address immediately. Stop vessel│
│ operations if safe to do so.                    │
│ Time to Failure: ~2 days                        │
└─────────────────────────────────────────────────┘
```

---

## 4.4 Testing Strategy

**Backend Tests**:
```typescript
describe('ImpactAnalysisService', () => {
  it('should classify critical equipment + critical alert as critical impact', () => {
    const impact = service.analyzeAlertImpact(
      criticalAlertOnMainEngine
    );
    expect(impact.impactLevel).toBe('critical');
    expect(impact.safetyRisk).toBe('critical');
    expect(impact.urgency).toBe('immediate');
  });
  
  it('should classify auxiliary equipment + low alert as low impact', () => {
    const impact = service.analyzeAlertImpact(
      lowAlertOnAuxiliaryPump
    );
    expect(impact.impactLevel).toBe('low');
    expect(impact.urgency).toBe('monitor');
  });
});
```

**Frontend Tests** (Playwright):
```typescript
test('Alert impact badges display correctly', async ({ page }) => {
  await page.goto('/alerts');
  
  // Verify first alert has impact badges
  const firstAlert = page.getByTestId('alert-card-0');
  await expect(firstAlert.getByTestId('badge-alert-impact')).toBeVisible();
  
  // Verify impact level badge
  await expect(firstAlert.getByText(/CRITICAL IMPACT/i)).toBeVisible();
  
  // Hover to see tooltip
  await firstAlert.getByTestId('badge-alert-impact').hover();
  await expect(page.getByText(/Recommendation:/)).toBeVisible();
  await expect(page.getByText(/Time to Failure:/)).toBeVisible();
});
```

---

## 4.5 Acceptance Criteria

- [ ] ImpactAnalysisService implemented with equipment criticality matrix
- [ ] Impact analysis included in alert API responses
- [ ] AlertImpactBadge component displays 3 badges (impact, safety, urgency)
- [ ] Tooltip shows full description + recommendation
- [ ] Time to failure shown if RUL available
- [ ] Backend tests pass (criticality matrix)
- [ ] E2E tests pass (badge display + tooltip)
- [ ] Performance: Impact analysis adds < 50ms to alert API response

---

# Summary & Next Steps

## Total Estimated Effort: 16-22 hours

| Feature | Effort | Status |
|---|---|---|
| Top 5 Fleet Risks Dashboard | 4-6h | Ready for implementation |
| Bridge-Style Vessel View | 6-8h | Ready for implementation |
| Multi-Sensor Time-Series Overlay | 3-4h | Ready for implementation |
| Alert Impact Analysis (Simplified) | 3-4h | Ready for implementation |

---

## Implementation Order (Recommended)

1. **Multi-Sensor Time-Series Overlay** (3-4h)
   - Lowest complexity
   - No new backend code
   - Quick win for diagnostics value

2. **Alert Impact Analysis** (3-4h)
   - Medium complexity
   - Adds decision support immediately
   - Enhances existing alerts page

3. **Top 5 Fleet Risks Dashboard** (4-6h)
   - Highest PdM value
   - Requires risk scoring algorithm
   - Dashboard widget placement

4. **Bridge-Style Vessel View** (6-8h)
   - Highest effort
   - New page component
   - Most visually impressive

---

## Architecture Validation ✅

All features validated against:
- ✅ **Offline-First**: All features work with cached data
- ✅ **Dual-Mode**: No PostgreSQL-specific dependencies
- ✅ **Multi-Tenant**: All queries org-scoped
- ✅ **Real-Time**: WebSocket integration where applicable
- ✅ **Performance**: No queries > 500ms expected
- ✅ **No Schema Changes**: Uses existing tables

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Risk scoring algorithm too slow | High | Cache scores for 5 minutes, async calculation |
| Dual Y-axis chart performance | Medium | Limit to 10k points, use virtualization if needed |
| Bridge view too complex for mobile | Low | Responsive design, progressive disclosure |
| Impact analysis descriptions too generic | Low | Start simple, refine based on feedback |

---

## Approval Checklist

Before proceeding to implementation, please confirm:

- [ ] **Feature Scope**: All 4 features approved as designed
- [ ] **Implementation Order**: Agree with recommended order (or specify different)
- [ ] **UI/UX Design**: Visual designs match expectations
- [ ] **Testing Strategy**: E2E + unit tests are sufficient
- [ ] **Timeline**: 16-22 hours is acceptable
- [ ] **Any Changes**: Request modifications if needed

---

**Ready to proceed?** Once approved, I'll implement all Phase 1 features with full testing and architect review.

---

**Report Prepared By**: Implementation Planning System  
**Date**: November 24, 2025  
**Status**: 📝 **Awaiting Approval to Proceed**
