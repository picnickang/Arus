# ARUS Refactoring Implementation Guide

## Quick Win #1: Create Reusable CRUD Mutation Hooks

### Current Problem
This pattern is duplicated 50+ times across the codebase:

```typescript
// Duplicated in every component
const createMutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/endpoint', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/endpoint"] });
    toast({ title: "Success", description: "Item created successfully" });
  },
  onError: (error) => {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  },
});
```

### Solution

**Create:** `client/src/hooks/useCrudMutations.ts`

```typescript
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CrudMutationOptions<T> {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useCreateMutation<T>(
  endpoint: string,
  options?: CrudMutationOptions<T>
) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: T) => apiRequest('POST', endpoint, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Created",
        description: options?.successMessage || "Successfully created",
      });
      options?.onSuccess?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });
      options?.onError?.(error);
    },
  });
}

export function useUpdateMutation<T>(
  endpoint: string,
  options?: CrudMutationOptions<T>
) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
      apiRequest('PUT', `${endpoint}/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Updated",
        description: options?.successMessage || "Successfully updated",
      });
      options?.onSuccess?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });
      options?.onError?.(error);
    },
  });
}

export function useDeleteMutation(
  endpoint: string,
  options?: CrudMutationOptions<string>
) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Deleted",
        description: options?.successMessage || "Successfully deleted",
      });
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });
      options?.onError?.(error);
    },
  });
}

// Batch operations
export function useBatchDeleteMutation(
  endpoint: string,
  options?: CrudMutationOptions<string[]>
) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest('POST', `${endpoint}/batch-delete`, { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Deleted",
        description: options?.successMessage || "Successfully deleted items",
      });
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: options?.errorMessage || error.message,
        variant: "destructive",
      });
      options?.onError?.(error);
    },
  });
}
```

### Usage

**Before:**
```typescript
// sensor-config.tsx (30+ lines of mutation code)
const createConfigMutation = useMutation({
  mutationFn: (data: SensorConfigFormData) => 
    apiRequest('POST', '/api/sensor-configs', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sensor-configs"] });
    setIsDialogOpen(false);
    setFormData(defaultFormData);
    toast({
      title: "Configuration Created",
      description: "Sensor configuration has been successfully created.",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Creation Failed",
      description: error.message,
      variant: "destructive",
    });
  },
});
```

**After:**
```typescript
// sensor-config.tsx (3 lines!)
const createConfigMutation = useCreateMutation<SensorConfigFormData>('/api/sensor-configs', {
  successMessage: "Sensor configuration created successfully",
  onSuccess: () => {
    setIsDialogOpen(false);
    setFormData(defaultFormData);
  },
});
```

---

## Quick Win #2: Consolidate Statistical Utilities

### Current Problem
Statistical functions scattered across 4+ files:
- `server/enhanced-trends.ts`
- `server/pdm-features.ts`
- `server/weibull-rul.ts`
- `server/sensor-optimization.ts`

### Solution

**Create:** `server/utils/statistics.ts`

```typescript
import { mean, standardDeviation, quantile } from 'simple-statistics';

/**
 * Calculate basic statistical summary
 */
export function calculateSummaryStats(values: number[]) {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      std: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  
  return {
    count: values.length,
    mean: mean(values),
    median: sorted[Math.floor(sorted.length / 2)],
    std: standardDeviation(values),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Detect anomalies using IQR method
 */
export function detectIQRAnomalies(values: number[], multiplier: number = 1.5) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return values.map((value, index) => ({
    index,
    value,
    isAnomaly: value < lowerBound || value > upperBound,
    deviation: value < lowerBound ? lowerBound - value : value > upperBound ? value - upperBound : 0,
  }));
}

/**
 * Detect anomalies using Z-score method
 */
export function detectZScoreAnomalies(values: number[], threshold: number = 3) {
  const avg = mean(values);
  const std = standardDeviation(values);

  return values.map((value, index) => {
    const zScore = Math.abs((value - avg) / std);
    return {
      index,
      value,
      zScore,
      isAnomaly: zScore > threshold,
      deviation: Math.abs(value - avg),
    };
  });
}

/**
 * Calculate RMS (Root Mean Square)
 */
export function calculateRMS(values: number[]): number {
  if (values.length === 0) return 0;
  const sumOfSquares = values.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumOfSquares / values.length);
}

/**
 * Calculate Kurtosis
 */
export function calculateKurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) return 0;
  
  const avg = mean(values);
  const std = standardDeviation(values);
  
  const m4 = values.reduce((sum, val) => {
    return sum + Math.pow((val - avg) / std, 4);
  }, 0) / n;
  
  return m4 - 3; // Excess kurtosis
}

/**
 * Calculate Skewness
 */
export function calculateSkewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  
  const avg = mean(values);
  const std = standardDeviation(values);
  
  const m3 = values.reduce((sum, val) => {
    return sum + Math.pow((val - avg) / std, 3);
  }, 0) / n;
  
  return m3;
}

/**
 * Linear regression
 */
export function linearRegression(x: number[], y: number[]) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const rSquared = 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

/**
 * Moving average
 */
export function movingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(mean(window));
  }
  return result;
}

/**
 * Exponential moving average
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}
```

### Update existing files to import from utils:

```typescript
// server/enhanced-trends.ts
import { 
  calculateSummaryStats,
  detectIQRAnomalies,
  detectZScoreAnomalies,
  linearRegression 
} from './utils/statistics';

// Remove duplicated functions, use imported ones
```

---

## Quick Win #3: Standardize Error Responses

### Current Problem
Inconsistent error responses across endpoints:

```typescript
// Old pattern (inconsistent)
res.status(500).json({ message: "Failed" });

// Mixed patterns
res.status(400).json({ error: "Bad request" });
res.status(404).send("Not found");
```

### Solution

**Create:** `server/utils/api-response.ts`

```typescript
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

export const ApiErrorCodes = {
  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  
  // Authentication Errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Authorization Errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Resource Errors (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // Conflict Errors (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Server Errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export function successResponse<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: any
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

// Express response helpers
export function sendSuccess<T>(res: any, data: T, statusCode: number = 200) {
  res.status(statusCode).json(successResponse(data));
}

export function sendError(
  res: any,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
) {
  res.status(statusCode).json(errorResponse(code, message, details));
}
```

### Usage

**Before:**
```typescript
app.get('/api/equipment/:id', async (req, res) => {
  try {
    const equipment = await storage.getEquipment(req.params.id);
    if (!equipment) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ message: "Failed" });
  }
});
```

**After:**
```typescript
import { sendSuccess, sendError, ApiErrorCodes } from './utils/api-response';

app.get('/api/equipment/:id', async (req, res) => {
  try {
    const equipment = await storage.getEquipment(req.params.id);
    if (!equipment) {
      return sendError(
        res,
        ApiErrorCodes.NOT_FOUND,
        'Equipment not found',
        404,
        { equipmentId: req.params.id }
      );
    }
    sendSuccess(res, equipment);
  } catch (error) {
    sendError(
      res,
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch equipment',
      500,
      { error: error.message }
    );
  }
});
```

---

## Quick Win #4: Centralize Rate Limiting

### Current Problem
Rate limits scattered throughout routes.ts:

```typescript
const telemetryRateLimit = rateLimit({ max: 120, ... });
const bulkImportRateLimit = rateLimit({ max: 10, ... });
const generalApiRateLimit = rateLimit({ max: 300, ... });
const writeOperationRateLimit = rateLimit({ max: 60, ... });
const criticalOperationRateLimit = rateLimit({ max: 20, ... });
```

### Solution

**Create:** `server/config/rate-limits.ts`

```typescript
import rateLimit from 'express-rate-limit';

// IP key generator for IPv6 support
function ipKeyGenerator(req: any): string {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

// Rate limit configurations
export const RateLimitConfig = {
  TELEMETRY: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // 2 per second
    message: {
      error: "Too many telemetry requests. Limit: 2 readings/second",
      code: "RATE_LIMIT_TELEMETRY"
    },
  },
  
  BULK_IMPORT: {
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: {
      error: "Too many bulk import requests",
      code: "RATE_LIMIT_BULK_IMPORT"
    },
  },
  
  GENERAL_API: {
    windowMs: 1 * 60 * 1000,
    max: 300,
    message: {
      error: "Too many API requests",
      code: "RATE_LIMIT_GENERAL"
    },
  },
  
  WRITE_OPERATIONS: {
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: {
      error: "Too many write operations",
      code: "RATE_LIMIT_WRITE_OPERATIONS"
    },
  },
  
  CRITICAL_OPERATIONS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20,
    message: {
      error: "Too many critical operations",
      code: "RATE_LIMIT_CRITICAL_OPERATIONS"
    },
  },
};

function createRateLimit(config: typeof RateLimitConfig.TELEMETRY) {
  return rateLimit({
    ...config,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req);
      const userAgent = req.get('User-Agent')?.slice(0, 50) || 'unknown';
      return `${ip}-${userAgent}`;
    },
  });
}

// Export configured limiters
export const telemetryRateLimit = createRateLimit(RateLimitConfig.TELEMETRY);
export const bulkImportRateLimit = createRateLimit(RateLimitConfig.BULK_IMPORT);
export const generalApiRateLimit = createRateLimit(RateLimitConfig.GENERAL_API);
export const writeOperationRateLimit = createRateLimit(RateLimitConfig.WRITE_OPERATIONS);
export const criticalOperationRateLimit = createRateLimit(RateLimitConfig.CRITICAL_OPERATIONS);
```

**Update routes.ts:**
```typescript
import {
  telemetryRateLimit,
  bulkImportRateLimit,
  generalApiRateLimit,
  writeOperationRateLimit,
  criticalOperationRateLimit,
} from './config/rate-limits';

// Remove all rate limit definitions from routes.ts
// Use imported limiters
```

---

## Quick Win #5: Extract Shell Script Utilities

### Current Problem
Duplicate logging and color functions in install.sh and deploy.sh

### Solution

**Create:** `scripts/utils/colors.sh`

```bash
#!/bin/bash

# Color definitions
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export MAGENTA='\033[0;35m'
export NC='\033[0m' # No Color
```

**Create:** `scripts/utils/logger.sh`

```bash
#!/bin/bash

# Source colors
source "$(dirname "$0")/colors.sh"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}===${NC} $1 ${CYAN}===${NC}\n"
}
```

**Update install.sh:**
```bash
#!/bin/bash

# Source utilities
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/utils/logger.sh"

log_step "Starting ARUS Installation"
log_info "Checking prerequisites..."
# ... rest of script
```

**Update deploy.sh:**
```bash
#!/bin/bash

# Source utilities
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/utils/logger.sh"

log_step "Deploying ARUS"
log_info "Building application..."
# ... rest of script
```

---

## Implementation Checklist

### Week 1
- [ ] Create `client/src/hooks/useCrudMutations.ts`
- [ ] Update 5 components to use new hooks (test)
- [ ] Create `server/utils/statistics.ts`
- [ ] Migrate statistical functions from enhanced-trends.ts

### Week 2
- [ ] Create `server/utils/api-response.ts`
- [ ] Update 10 endpoints to use standardized responses
- [ ] Create `server/config/rate-limits.ts`
- [ ] Migrate rate limit configs

### Week 3
- [ ] Create shell script utilities
- [ ] Update install.sh and deploy.sh
- [ ] Roll out CRUD hooks to all components
- [ ] Complete statistical utils migration

### Week 4
- [ ] Standardize all API responses
- [ ] Document new patterns
- [ ] Update README with new architecture

---

## Measuring Success

### Code Metrics (Before → After)

| Metric | Before | Target |
|--------|--------|--------|
| Lines in sensor-config.tsx | 795 | <400 |
| Duplicated mutation code | 50+ instances | 0 instances |
| Inconsistent API responses | 20+ endpoints | 0 endpoints |
| Scattered rate limits | 5 locations | 1 location |
| Duplicated statistical functions | 15+ functions | 0 duplicates |

### Development Velocity

- **Before:** 30 minutes to add new CRUD endpoint
- **After:** 5 minutes with reusable hooks

- **Before:** 1 hour to add statistical analysis
- **After:** 10 minutes with utils library

---

## Next Steps

After implementing these quick wins:

1. **Module splitting** (storage.ts → domain modules)
2. **Route organization** (routes.ts → feature routes)
3. **Frontend restructuring** (feature-based architecture)
4. **Service layer** extraction
5. **Repository pattern** implementation

See `CODE_QUALITY_ANALYSIS.md` for comprehensive refactoring plan.
