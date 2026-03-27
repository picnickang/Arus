export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DesktopAPI {
  getAppVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  checkForUpdates: () => Promise<UpdateInfo | null>;
  installUpdate: () => Promise<void>;
  getAppDataDir: () => Promise<string>;
  getRuntimeMode: () => Promise<'packaged' | 'dev'>;
  getBackendUrl: () => Promise<string>;
}

declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>;
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

export function isDesktop(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.__TAURI_INTERNALS__ !== undefined &&
     typeof (window.__TAURI_INTERNALS__ as any)?.invoke === 'function')
  );
}

const TAURI_CORE = '@tauri-apps/api/core';
const TAURI_UPDATER = '@tauri-apps/plugin-updater';
const TAURI_PROCESS = '@tauri-apps/plugin-process';

function dynamicImport(mod: string): Promise<any> {
  return new Function('m', 'return import(m)')(mod).catch(() => null);
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const coreModule = await dynamicImport(TAURI_CORE);
  if (!coreModule) throw new Error('Tauri core not available');
  return coreModule.invoke<T>(cmd, args);
}

export function getDesktopAPI(): DesktopAPI | undefined {
  if (!isDesktop()) {
    return undefined;
  }

  return {
    async getAppVersion(): Promise<string> {
      try {
        const info = await tauriInvoke<{ version: string; name: string; identifier: string }>('get_app_version');
        return info.version;
      } catch (err) {
        console.warn('[Desktop] getAppVersion failed:', err);
        return 'unknown';
      }
    },

    async isPackaged(): Promise<boolean> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>('get_runtime_state');
        return state.packaged;
      } catch (err) {
        console.warn('[Desktop] isPackaged failed:', err);
        return false;
      }
    },

    async checkForUpdates(): Promise<UpdateInfo | null> {
      try {
        const updaterModule = await dynamicImport(TAURI_UPDATER);
        if (!updaterModule) return null;
        const update = await updaterModule.check();
        if (!update) return null;
        (this as any)._pendingUpdate = update;
        return {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        };
      } catch (err) {
        console.warn('[Desktop] checkForUpdates failed:', err);
        return null;
      }
    },

    async installUpdate(): Promise<void> {
      try {
        const updaterModule = await dynamicImport(TAURI_UPDATER);
        if (!updaterModule) return;
        const cached = (this as any)._pendingUpdate;
        const update = cached || await updaterModule.check();
        if (update) {
          (this as any)._pendingUpdate = null;
          await update.downloadAndInstall();
          const processModule = await dynamicImport(TAURI_PROCESS);
          if (processModule) {
            await processModule.relaunch();
          }
        }
      } catch (err) {
        console.warn('[Desktop] installUpdate failed:', err);
      }
    },

    async getAppDataDir(): Promise<string> {
      try {
        return await tauriInvoke<string>('get_app_data_dir');
      } catch (err) {
        console.warn('[Desktop] getAppDataDir failed:', err);
        return '';
      }
    },

    async getRuntimeMode(): Promise<'packaged' | 'dev'> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>('get_runtime_state');
        return state.packaged ? 'packaged' : 'dev';
      } catch (err) {
        console.warn('[Desktop] getRuntimeMode failed:', err);
        return 'dev';
      }
    },

    async getBackendUrl(): Promise<string> {
      try {
        const config = await tauriInvoke<{ url: string; mode: string }>('get_backend_config');
        return config.url;
      } catch (err) {
        console.warn('[Desktop] getBackendUrl failed:', err);
        return '';
      }
    },
  };
}

export async function getAppVersion(): Promise<string> {
  const api = getDesktopAPI();
  if (!api) return 'web';
  return api.getAppVersion();
}

export async function isPackaged(): Promise<boolean> {
  const api = getDesktopAPI();
  if (!api) return false;
  return api.isPackaged();
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const api = getDesktopAPI();
  if (!api) return null;
  return api.checkForUpdates();
}

export async function installUpdate(): Promise<void> {
  const api = getDesktopAPI();
  if (!api) return;
  return api.installUpdate();
}
