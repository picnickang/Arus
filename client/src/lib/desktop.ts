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
  getRuntimeMode: () => Promise<"packaged" | "dev">;
  getBackendUrl: () => Promise<string>;
}

declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>;
    __TAURI_INTERNALS__?: { invoke?: unknown; [key: string]: unknown };
  }
}

export function isDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__ !== "undefined" &&
    typeof (window.__TAURI_INTERNALS__ as { invoke?: unknown } | undefined)?.invoke === "function"
  );
}

const TAURI_CORE = "@tauri-apps/api/core";
const TAURI_UPDATER = "@tauri-apps/plugin-updater";
const TAURI_PROCESS = "@tauri-apps/plugin-process";

type TauriModule = Record<string, unknown>;

function dynamicImport(mod: string): Promise<TauriModule | null> {
  return (
    new Function("m", "return import(m)")(mod) as Promise<TauriModule>
  ).catch(() => null);
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await dynamicImport(TAURI_CORE);
  if (!core) {
    throw new Error("Tauri core not available");
  }
  return ((core.invoke as (c: string, a?: Record<string, unknown>) => unknown)(cmd, args)) as Promise<T>;
}

interface TauriUpdate {
  version: string;
  date?: string | null;
  body?: string | null;
  downloadAndInstall: () => Promise<void>;
}

interface CachedUpdate {
  info: UpdateInfo;
  raw: TauriUpdate;
}

let _updateCache: CachedUpdate | null = null;

export function getDesktopAPI(): DesktopAPI | undefined {
  if (!isDesktop()) {
    return undefined;
  }

  return {
    async getAppVersion(): Promise<string> {
      try {
        const info = await tauriInvoke<{ version: string }>("get_app_version");
        return info.version;
      } catch (err) {
        console.warn("[Desktop] getAppVersion:", err);
        return "unknown";
      }
    },

    async isPackaged(): Promise<boolean> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>("get_runtime_state");
        return state.packaged;
      } catch (err) {
        console.warn("[Desktop] isPackaged:", err);
        return false;
      }
    },

    async checkForUpdates(): Promise<UpdateInfo | null> {
      try {
        const updater = await dynamicImport(TAURI_UPDATER);
        if (!updater) {
          return null;
        }

        const update = (await (updater.check as () => Promise<TauriUpdate | null>)()) as TauriUpdate | null;
        if (!update) {
          _updateCache = null;
          return null;
        }

        const info: UpdateInfo = {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        };
        _updateCache = { info, raw: update };
        return info;
      } catch (err) {
        console.warn("[Desktop] checkForUpdates:", err);
        return null;
      }
    },

    async installUpdate(): Promise<void> {
      try {
        const updater = await dynamicImport(TAURI_UPDATER);
        if (!updater) {
          return;
        }

        const update =
          _updateCache?.raw ??
          ((await (updater.check as () => Promise<TauriUpdate | null>)()) as TauriUpdate | null);
        _updateCache = null;

        if (update) {
          await update.downloadAndInstall();
          const process = await dynamicImport(TAURI_PROCESS);
          if (process) {
            await (process.relaunch as () => Promise<void>)();
          }
        }
      } catch (err) {
        console.warn("[Desktop] installUpdate:", err);
      }
    },

    async getAppDataDir(): Promise<string> {
      try {
        return await tauriInvoke<string>("get_app_data_dir");
      } catch (err) {
        console.warn("[Desktop] getAppDataDir:", err);
        return "";
      }
    },

    async getRuntimeMode(): Promise<"packaged" | "dev"> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>("get_runtime_state");
        return state.packaged ? "packaged" : "dev";
      } catch (err) {
        console.warn("[Desktop] getRuntimeMode:", err);
        return "dev";
      }
    },

    async getBackendUrl(): Promise<string> {
      try {
        const config = await tauriInvoke<{ url: string }>("get_backend_config");
        return config.url ?? "";
      } catch (err) {
        console.warn("[Desktop] getBackendUrl:", err);
        return "";
      }
    },
  };
}

export async function getAppVersion(): Promise<string> {
  return getDesktopAPI()?.getAppVersion() ?? Promise.resolve("web");
}

export async function isPackaged(): Promise<boolean> {
  return getDesktopAPI()?.isPackaged() ?? Promise.resolve(false);
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  return getDesktopAPI()?.checkForUpdates() ?? Promise.resolve(null);
}

export async function installUpdate(): Promise<void> {
  return getDesktopAPI()?.installUpdate() ?? Promise.resolve();
}
