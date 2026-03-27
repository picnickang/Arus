import { isDesktop, getDesktopAPI } from './desktop';
import { validateBackendUrl } from './urlValidation';

let cachedBackendUrl: string | null = null;

export async function resolveBackendUrl(): Promise<string> {
  if (cachedBackendUrl !== null) return cachedBackendUrl;

  try {
    const stored = localStorage.getItem('arus-backend-url');
    if (stored) {
      cachedBackendUrl = stored;
      return stored;
    }
  } catch {
  }

  if (isDesktop()) {
    const api = getDesktopAPI();
    if (api) {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin) {
        cachedBackendUrl = url;
        return url;
      }
    }
  }

  cachedBackendUrl = '';
  return '';
}

export function getBackendUrlSync(): string {
  if (cachedBackendUrl !== null) return cachedBackendUrl;
  return localStorage.getItem('arus-backend-url') || '';
}

export function setBackendUrl(url: string): void {
  const normalized = url.replace(/\/+$/, '');
  cachedBackendUrl = normalized;
  localStorage.setItem('arus-backend-url', normalized);
}

export function clearBackendUrl(): void {
  cachedBackendUrl = null;
  localStorage.removeItem('arus-backend-url');
}

export function markSetupComplete(): void {
  localStorage.setItem('arus-setup-complete', 'true');
}

export function isDesktopSetupComplete(): boolean {
  if (!isDesktop()) return true;
  return localStorage.getItem('arus-setup-complete') === 'true';
}

export async function bootstrapDesktopBackend(): Promise<boolean> {
  if (!isDesktop()) return true;

  if (localStorage.getItem('arus-setup-complete') === 'true') {
    const stored = localStorage.getItem('arus-backend-url');
    if (stored) {
      cachedBackendUrl = stored;
      return true;
    }
  }

  const api = getDesktopAPI();
  if (api) {
    try {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin && url !== '') {
        const result = await testBackendConnection(url);
        if (result.ok) {
          setBackendUrl(url);
          markSetupComplete();
          return true;
        }
      }
    } catch (err) {
      console.warn('[Desktop] bootstrapDesktopBackend failed:', err);
    }
  }

  return false;
}

export function getVesselId(): string {
  return localStorage.getItem('arus-vessel-id') || '';
}

export function setVesselId(vesselId: string): void {
  localStorage.setItem('arus-vessel-id', vesselId);
}

export function getVesselName(): string {
  return localStorage.getItem('arus-vessel-name') || '';
}

export function setVesselName(name: string): void {
  localStorage.setItem('arus-vessel-name', name);
}

export async function desktopFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api')) {
    const base = await resolveBackendUrl();
    if (base) {
      return fetch(`${base}${input}`, init);
    }
  }
  return fetch(input, init);
}

export async function testBackendConnection(url: string): Promise<{ ok: boolean; message: string }> {
  const validation = validateBackendUrl(url);
  if (!validation.valid) {
    return { ok: false, message: validation.error || 'Invalid URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${validation.normalized}/api/healthz`, {
      signal: controller.signal,
      headers: { 'x-org-id': 'default-org-id' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      return { ok: true, message: 'Connected successfully' };
    }
    return { ok: false, message: `Server responded with status ${res.status}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('abort')) {
      return { ok: false, message: 'Connection timed out (5 seconds)' };
    }
    return { ok: false, message: `Could not connect: ${msg}` };
  }
}
