import { isDesktop, getDesktopAPI } from "./desktop";

const STORAGE_KEY = "arus_backend_url";
const LEGACY_KEY = "arus-backend-url";
const DEFAULT_URL = "http://localhost:5000";

let _cachedUrl: string | null = null;

function tauriImport(mod: string): Promise<any> {
  return new Function("m", "return import(m)")(mod).catch(() => null);
}

export async function resolveBackendUrl(): Promise<string> {
  if (_cachedUrl) {
    return _cachedUrl;
  }

  if (isDesktop()) {
    try {
      const core = await tauriImport("@tauri-apps/api/core");
      if (core) {
        const config = await core.invoke<{ url: string; mode: string }>("get_backend_config");
        if (config?.url) {
          _cachedUrl = config.url;
          return _cachedUrl;
        }
      }
    } catch {}
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (stored) {
      _cachedUrl = stored;
      return _cachedUrl;
    }
  } catch {}

  _cachedUrl = isDesktop() ? DEFAULT_URL : "";
  return _cachedUrl;
}

export function getBackendUrlSync(): string {
  if (_cachedUrl) {
    return _cachedUrl;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (stored) {
      return stored;
    }
  } catch {}
  if (isDesktop()) {
    return DEFAULT_URL;
  }
  return "";
}

export function setBackendUrl(url: string): void {
  const normalized = url.replace(/\/+$/, "");
  _cachedUrl = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
    localStorage.setItem(LEGACY_KEY, normalized);
  } catch {}
}

export function clearBackendUrl(): void {
  _cachedUrl = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export async function testBackendConnection(
  url: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/healthz`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "x-org-id": "default-org-id" },
    });
    clearTimeout(timer);
    if (res.ok) {
      return { ok: true, message: "Connected successfully" };
    }
    return { ok: false, message: `Server responded with status ${res.status}` };
  } catch (e: unknown) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("abort")) {
      return { ok: false, message: "Connection timed out" };
    }
    return { ok: false, message: `Could not connect: ${msg}` };
  }
}

export async function isDesktopSetupComplete(): Promise<boolean> {
  if (!isDesktop()) {
    return true;
  }

  const url = await resolveBackendUrl();

  const reachable = await testBackendConnection(url);
  if (!reachable.ok) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/api/setup/status`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return false;
    }
    const body = (await res.json()) as { complete: boolean };
    return body.complete === true;
  } catch {
    return true;
  }
}

export function isDesktopSetupCompleteSync(): boolean {
  if (!isDesktop()) {
    return true;
  }
  return localStorage.getItem("arus-setup-complete") === "true";
}

export function markSetupComplete(): void {
  localStorage.setItem("arus-setup-complete", "true");
}

export async function bootstrapDesktopBackend(): Promise<boolean> {
  if (!isDesktop()) {
    return true;
  }

  if (localStorage.getItem("arus-setup-complete") === "true") {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (stored) {
      _cachedUrl = stored;
      return true;
    }
  }

  const api = getDesktopAPI();
  if (api) {
    try {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin && url !== "") {
        const result = await testBackendConnection(url);
        if (result.ok) {
          setBackendUrl(url);
          markSetupComplete();
          return true;
        }
      }
    } catch (err) {
      console.warn("[Desktop] bootstrapDesktopBackend failed:", err);
    }
  }

  return false;
}

export function getVesselId(): string {
  return localStorage.getItem("arus-vessel-id") || "";
}

export function setVesselId(vesselId: string): void {
  localStorage.setItem("arus-vessel-id", vesselId);
}

export function getVesselName(): string {
  return localStorage.getItem("arus-vessel-name") || "";
}

export function setVesselName(name: string): void {
  localStorage.setItem("arus-vessel-name", name);
}

export async function desktopFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (typeof input === "string" && input.startsWith("/api")) {
    const base = await resolveBackendUrl();
    if (base) {
      return fetch(`${base}${input}`, init);
    }
  }
  return fetch(input, init);
}
