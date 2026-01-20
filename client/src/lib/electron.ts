/**
 * Electron Environment Detection and API Utilities
 * 
 * This module provides utilities for detecting whether the app is running
 * in Electron and accessing the Electron API exposed via preload script.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { isElectron, getElectronAPI } from '@/lib/electron';
 * 
 * if (isElectron()) {
 *   const api = getElectronAPI();
 *   const version = await api.update.getVersion();
 * }
 * ```
 */

export interface UpdateProgressData {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateAvailableData {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateDownloadedData {
  version: string;
  releaseNotes?: string;
}

export interface UpdateErrorData {
  message: string;
  stack?: string;
}

export interface UpdateCheckInfo { version?: string; releaseNotes?: string; releaseDate?: string; }

export interface ElectronUpdateAPI {
  check: () => Promise<{ success: boolean; updateInfo?: UpdateCheckInfo; error?: string }>;
  download: () => Promise<{ success: boolean; error?: string }>;
  install: () => void;
  getVersion: () => Promise<string>;
  getState: () => Promise<{ version: string; isPackaged: boolean }>;
  onAvailable: (callback: (data: UpdateAvailableData) => void) => () => void;
  onNotAvailable: (callback: (data: { version: string }) => void) => () => void;
  onDownloadProgress: (callback: (data: UpdateProgressData) => void) => () => void;
  onDownloaded: (callback: (data: UpdateDownloadedData) => void) => () => void;
  onError: (callback: (data: UpdateErrorData) => void) => () => void;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  isElectron: true;
  update: ElectronUpdateAPI;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

/**
 * Check if the app is running in Electron environment
 * 
 * Uses multiple detection methods for reliability:
 * 1. Checks for globalThis.electron (exposed by preload)
 * 2. Checks for process.versions.electron (legacy)
 */
export function isElectron(): boolean {
  // Check for our exposed API first (most reliable)
  if (typeof globalThis !== 'undefined' && globalThis.electron?.isElectron === true) {
    return true;
  }
  
  // Fallback check for older Electron versions or different preload configs
  if (typeof globalThis !== 'undefined') {
    const win = window as Window & { process?: { versions?: { electron?: string } } };
    if (win.process?.versions?.electron) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the Electron API exposed by preload script
 * 
 * @returns ElectronAPI if running in Electron, undefined otherwise
 */
export function getElectronAPI(): ElectronAPI | undefined {
  if (typeof globalThis !== 'undefined' && globalThis.electron) {
    return globalThis.electron;
  }
  return undefined;
}

/**
 * Check if auto-updates are available in current environment
 * 
 * Returns true only if:
 * 1. Running in Electron
 * 2. Running packaged app (not dev mode)
 */
export async function isAutoUpdateAvailable(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) {
    return false;
  }
  
  try {
    const state = await api.update.getState();
    return state.isPackaged;
  } catch {
    return false;
  }
}

/**
 * Get current app version
 * 
 * @returns Version string or 'unknown' if not in Electron
 */
export async function getAppVersion(): Promise<string> {
  const api = getElectronAPI();
  if (!api) {
    return 'unknown';
  }
  
  try {
    return await api.update.getVersion();
  } catch {
    return 'unknown';
  }
}
