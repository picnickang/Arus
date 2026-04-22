/**
 * ARUS Performance Logger Utility
 * 
 * Lightweight performance monitoring for React components and operations.
 * Enable via: localStorage.setItem('PERF_DEBUG', 'true')
 * 
 * Features:
 * - Component mount/render timing
 * - Render count tracking
 * - Operation timing (console.time wrapper)
 * - React Query refetch tracking
 * 
 * Usage:
 *   import { useRenderCount, useMountTime, perfTime } from '@/utils/perfLog';
 *   
 *   // Track render count
 *   useRenderCount('Dashboard');
 *   
 *   // Track mount time
 *   useMountTime('Dashboard');
 *   
 *   // Time an operation
 *   perfTime.start('fetchData');
 *   await fetchData();
 *   perfTime.end('fetchData');
 */

import { useEffect, useRef } from 'react';

const PERF_DEBUG_KEY = 'PERF_DEBUG';

// Check if performance debugging is enabled
export function isPerfDebugEnabled(): boolean {
  if (typeof globalThis === 'undefined') {
    return false;
  }
  return localStorage.getItem(PERF_DEBUG_KEY) === 'true';
}

// Enable/disable performance debugging
export function setPerfDebug(enabled: boolean): void {
  if (typeof globalThis === 'undefined') {
    return;
  }
  localStorage.setItem(PERF_DEBUG_KEY, enabled ? 'true' : 'false');
  console.info(`[PerfLog] Performance debugging ${enabled ? 'enabled' : 'disabled'}`);
}

// Performance log with optional color coding
function perfLog(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warn' | 'slow' = 'info'
): void {
  if (!isPerfDebugEnabled()) {
    return;
  }
  
  const colors = {
    info: 'color: #10b981',
    warn: 'color: #f59e0b',
    slow: 'color: #ef4444; font-weight: bold',
  };
  
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  
  if (data) {
    console.info(`%c[PerfLog:${category}] ${timestamp} ${message}`, colors[level], data);
  } else {
    console.info(`%c[PerfLog:${category}] ${timestamp} ${message}`, colors[level]);
  }
}

// Render count storage
const renderCounts: Map<string, number> = new Map();

/**
 * Hook to track render count of a component
 * Logs to console when PERF_DEBUG=true
 */
export function useRenderCount(componentName: string): number {
  const countRef = useRef(0);
  countRef.current++;
  
  // Update global map
  renderCounts.set(componentName, countRef.current);
  
  // Log every 5 renders to reduce noise
  if (isPerfDebugEnabled() && countRef.current % 5 === 0) {
    perfLog('Render', `${componentName} rendered ${countRef.current} times`);
  }
  
  return countRef.current;
}

/**
 * Hook to track component mount time
 */
export function useMountTime(componentName: string): void {
  const startTimeRef = useRef(performance.now());
  
  useEffect(() => {
    const mountTime = performance.now() - startTimeRef.current;
    const level = mountTime > 100 ? 'slow' : mountTime > 50 ? 'warn' : 'info';
    
    perfLog('Mount', `${componentName} mounted in ${mountTime.toFixed(2)}ms`, undefined, level);
    
    return () => {
      perfLog('Unmount', `${componentName} unmounted`);
    };
  }, [componentName]);
}

/**
 * Hook to track effect execution time
 */
export function useEffectTime(effectName: string, deps: unknown[]): void {
  useEffect(() => {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      if (duration > 16) { // Log if effect takes longer than 1 frame
        perfLog('Effect', `${effectName} ran for ${duration.toFixed(2)}ms`, undefined, 'warn');
      }
    };
  }, deps);
}

// Operation timing utility
const timers: Map<string, number> = new Map();

export const perfTime = {
  start(label: string): void {
    timers.set(label, performance.now());
    if (isPerfDebugEnabled()) {
      console.time(`[PerfLog:Timer] ${label}`);
    }
  },
  
  end(label: string, warnThresholdMs = 200): number {
    const startTime = timers.get(label);
    const duration = startTime ? performance.now() - startTime : 0;
    timers.delete(label);
    
    if (isPerfDebugEnabled()) {
      console.timeEnd(`[PerfLog:Timer] ${label}`);
      
      if (duration > warnThresholdMs) {
        perfLog('Timer', `${label} took ${duration.toFixed(2)}ms (> ${warnThresholdMs}ms threshold)`, undefined, 'slow');
      }
    }
    
    return duration;
  },
  
  mark(label: string): void {
    if (isPerfDebugEnabled()) {
      performance.mark(`perf:${label}`);
      perfLog('Mark', label);
    }
  },
  
  measure(name: string, startMark: string, endMark?: string): number {
    if (!isPerfDebugEnabled()) {
      return 0;
    }
    
    try {
      const measureName = `measure:${name}`;
      performance.measure(measureName, `perf:${startMark}`, endMark ? `perf:${endMark}` : undefined);
      const entries = performance.getEntriesByName(measureName);
      const duration = entries[entries.length - 1]?.duration || 0;
      
      perfLog('Measure', `${name}: ${duration.toFixed(2)}ms`);
      return duration;
    } catch {
      return 0;
    }
  },
};

// React Query refetch tracking
const queryRefetchCounts: Map<string, { count: number; lastTime: number }> = new Map();

/**
 * Track React Query refetch frequency
 * Call this in your queryFn to monitor refetch patterns
 */
export function trackQueryRefetch(queryKey: string): void {
  if (!isPerfDebugEnabled()) {
    return;
  }
  
  const now = Date.now();
  const existing = queryRefetchCounts.get(queryKey) || { count: 0, lastTime: now };
  const timeSinceLast = now - existing.lastTime;
  
  existing.count++;
  existing.lastTime = now;
  queryRefetchCounts.set(queryKey, existing);
  
  // Warn if refetching too frequently (< 5 seconds apart)
  if (timeSinceLast < 5000 && existing.count > 1) {
    perfLog('Query', `${queryKey} refetched after ${timeSinceLast}ms (${existing.count} total)`, undefined, 'warn');
  } else if (existing.count % 10 === 0) {
    perfLog('Query', `${queryKey} refetch count: ${existing.count}`);
  }
}

// Get performance summary
export function getPerfSummary(): {
  renderCounts: Record<string, number>;
  queryRefetchCounts: Record<string, { count: number; lastTime: number }>;
} {
  return {
    renderCounts: Object.fromEntries(renderCounts),
    queryRefetchCounts: Object.fromEntries(queryRefetchCounts),
  };
}

// Debug command for console
if (typeof globalThis !== 'undefined') {
  const windowWithPerfLog = window as Window & { perfLog?: Record<string, unknown> };
  windowWithPerfLog.perfLog = {
    enable: () => setPerfDebug(true),
    disable: () => setPerfDebug(false),
    summary: getPerfSummary,
    renderCounts: () => Object.fromEntries(renderCounts),
    queryRefetchCounts: () => Object.fromEntries(queryRefetchCounts),
    clear: () => {
      renderCounts.clear();
      queryRefetchCounts.clear();
      console.info('[PerfLog] Cleared all tracking data');
    },
  };
  
  // Log availability on load
  if (isPerfDebugEnabled()) {
    console.info('%c🔍 Performance Debugging Enabled', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.info('Commands: globalThis.perfLog.summary(), globalThis.perfLog.disable()');
  }
}
