# ARUS Tauri v2 Desktop Files — Complete Code for Review

## File Tree

```
src-tauri/
├── Cargo.toml
├── build.rs
├── tauri.conf.json
├── capabilities/
│   └── default.json
├── icons/
│   ├── 32x32.png
│   ├── 128x128.png
│   ├── 128x128@2x.png
│   └── icon.png
└── src/
    ├── main.rs
    └── lib.rs

client/src/
└── lib/
    └── desktop.ts

package.json (relevant scripts & deps only)
```

---

## 1. `src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ARUS",
  "version": "1.0.0",
  "identifier": "com.arus.marine",
  "build": {
    "beforeDevCommand": "",
    "devUrl": "http://localhost:5000",
    "beforeBuildCommand": "npm run build:renderer",
    "frontendDist": "../dist/public"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "ARUS - Marine PdM System",
        "width": 1400,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 680,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http: https: https://*.arus.io; img-src 'self' data: blob:; font-src 'self' data:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png"
    ],
    "category": "Utility",
    "shortDescription": "ARUS Marine Predictive Maintenance System",
    "longDescription": "ARUS is a comprehensive marine predictive maintenance and vessel management system for fleet operators.",
    "macOS": {
      "minimumSystemVersion": "11.0"
    },
    "windows": {
      "wix": {
        "language": "en-US"
      }
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "",
      "endpoints": [
        "https://github.com/INSERT_OWNER/INSERT_REPO/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

---

## 2. `src-tauri/Cargo.toml`

```toml
[package]
name = "arus"
version = "1.0.0"
description = "ARUS Marine Predictive Maintenance System"
authors = ["ARUS Team"]
edition = "2021"

[lib]
name = "arus_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

---

## 3. `src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

---

## 4. `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    arus_lib::run()
}
```

---

## 5. `src-tauri/src/lib.rs`

```rust
use tauri::Manager;
use serde::Serialize;
use std::env;

#[derive(Serialize)]
struct AppInfo {
    version: String,
    name: String,
    identifier: String,
}

#[derive(Serialize)]
struct RuntimeState {
    packaged: bool,
    debug: bool,
    platform: String,
    arch: String,
}

#[derive(Serialize)]
struct BackendConfig {
    url: String,
    mode: String,
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> AppInfo {
    let config = app.config();
    AppInfo {
        version: config.version.clone().unwrap_or_else(|| "1.0.0".into()),
        name: config
            .product_name
            .clone()
            .unwrap_or_else(|| "ARUS".into()),
        identifier: config.identifier.clone(),
    }
}

#[tauri::command]
fn get_runtime_state() -> RuntimeState {
    let packaged = cfg!(not(debug_assertions));
    let debug = cfg!(debug_assertions);

    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "unknown"
    };

    RuntimeState {
        packaged,
        debug,
        platform: platform.into(),
        arch: arch.into(),
    }
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))
}

#[tauri::command]
fn get_backend_config() -> BackendConfig {
    let url = env::var("ARUS_BACKEND_URL").unwrap_or_else(|_| "http://localhost:5000".into());
    let mode = env::var("ARUS_MODE").unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            "development".into()
        } else {
            "production".into()
        }
    });

    BackendConfig { url, mode }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_runtime_state,
            get_app_data_dir,
            get_backend_config,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");
            #[cfg(debug_assertions)]
            window.open_devtools();
            let _ = window;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 6. `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "Default capabilities for the main ARUS window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "process:allow-relaunch",
    "process:allow-exit",
    "updater:default",
    {
      "identifier": "fs:allow-app-read",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "fs:allow-app-write",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    }
  ]
}
```

---

## 7. `client/src/lib/desktop.ts`

```typescript
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
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined)
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
        const update = await updaterModule.check();
        if (update) {
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
```

---

## 8. `package.json` (relevant excerpts)

```json
{
  "scripts": {
    "build:renderer": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.9.1",
    "@tauri-apps/cli": "^2.9.6"
  }
}
```

---

## 9. `client/src/pages/system-administration.tsx` (Tauri-relevant excerpts)

Lines 39 and 43 reference Tauri in the GitHub integration UI:

```tsx
{g.githubStatus?.connected && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Settings className="h-5 w-5" />Release Repository
      </CardTitle>
      <CardDescription>
        Select which GitHub repository to monitor for Tauri desktop app updates
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* ... repository selection UI ... */}
    </CardContent>
  </Card>
)}

<Card>
  <CardHeader>
    <CardTitle className="text-base">How GitHub Releases Work</CardTitle>
  </CardHeader>
  <CardContent>
    <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
      <li>GitHub is connected via Replit integration (automatic token management)</li>
      <li>Select which repository to monitor for releases above</li>
      <li>Build your Tauri desktop app with tauri:build</li>
      <li>Publish releases to GitHub - desktop apps will automatically update</li>
    </ol>
  </CardContent>
</Card>
```

---

## Icons

The following icon files exist at `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.png`

(Binary image files — not included as code.)
