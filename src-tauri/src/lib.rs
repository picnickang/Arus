use tauri::{Manager, AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde::Serialize;
use std::env;
use std::sync::{Arc, Mutex};
use std::time::Duration;

struct SidecarState(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

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

#[derive(Serialize, Clone)]
struct BackendStatus {
    running: bool,
    mode: String,
    url: String,
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> AppInfo {
    let config = app.config();
    AppInfo {
        version: config.version.clone().unwrap_or_else(|| "1.0.0".into()),
        name: config.product_name.clone().unwrap_or_else(|| "ARUS".into()),
        identifier: config.identifier.clone(),
    }
}

#[tauri::command]
fn get_runtime_state(app: AppHandle) -> RuntimeState {
    let packaged = app.is_packaged();
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

    RuntimeState { packaged, debug, platform: platform.into(), arch: arch.into() }
}

#[tauri::command]
fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))
}

#[tauri::command]
fn get_backend_config() -> BackendConfig {
    let url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());
    let mode = env::var("ARUS_MODE").unwrap_or_else(|_| {
        if cfg!(debug_assertions) { "development".into() } else { "production".into() }
    });
    BackendConfig { url, mode }
}

#[tauri::command]
async fn get_backend_status(app: AppHandle) -> BackendStatus {
    let url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());

    #[cfg(target_os = "windows")]
    {
        if is_windows_service_running("ARUSBackend") {
            return BackendStatus { running: true, mode: "service".into(), url };
        }
    }

    let state = app.state::<SidecarState>();
    let sidecar_alive = state.0.lock().unwrap().is_some();
    if sidecar_alive {
        return BackendStatus { running: true, mode: "sidecar".into(), url };
    }

    let running = ping_backend(&url).await;
    let mode = if running { "remote".into() } else { "offline".into() };
    BackendStatus { running, mode, url }
}

#[tauri::command]
async fn start_backend_sidecar(app: AppHandle) -> Result<(), String> {
    launch_sidecar(&app).await
}

async fn ping_backend(base_url: &str) -> bool {
    let url = format!("{}/api/healthz", base_url);
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("powershell")
            .args(["-Command",
                &format!("try {{ (Invoke-WebRequest -Uri '{}' -TimeoutSec 3).StatusCode }} catch {{ 0 }}", url)])
            .output();
        if let Ok(o) = output {
            let s = String::from_utf8_lossy(&o.stdout);
            return s.trim() == "200";
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = std::process::Command::new("curl")
            .args(["-sf", "--max-time", "3", "-o", "/dev/null", "-w", "%{http_code}", &url])
            .output();
        if let Ok(o) = output {
            return String::from_utf8_lossy(&o.stdout).trim() == "200";
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn is_windows_service_running(service_name: &str) -> bool {
    let output = std::process::Command::new("sc")
        .args(["query", service_name])
        .output();
    if let Ok(o) = output {
        let s = String::from_utf8_lossy(&o.stdout);
        return s.contains("RUNNING");
    }
    false
}

async fn launch_sidecar(app: &AppHandle) -> Result<(), String> {
    {
        let state = app.state::<SidecarState>();
        if state.0.lock().unwrap().is_some() {
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    if app.is_packaged() && is_windows_service_running("ARUSBackend") {
        return Ok(());
    }

    let backend_url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());

    let app_data = app.path().app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;

    let db_path = app_data.join("vessel-local.db");

    let sidecar_cmd = app.shell()
        .sidecar("arus-server")
        .map_err(|e| format!("Sidecar not found: {}", e))?
        .env("NODE_ENV", if cfg!(debug_assertions) { "development" } else { "production" })
        .env("PORT", "5000")
        .env("ARUS_BACKEND_URL", &backend_url)
        .env("DATABASE_PATH", db_path.to_string_lossy().as_ref())
        .env("DEPLOYMENT_MODE", "VESSEL")
        .env("LOCAL_MODE", "true");

    let (mut rx, child) = sidecar_cmd.spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    {
        let state = app.state::<SidecarState>();
        *state.0.lock().unwrap() = Some(child);
    }

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let _ = app_clone.emit("backend-log",
                        String::from_utf8_lossy(&line).to_string());
                }
                CommandEvent::Stderr(line) => {
                    let _ = app_clone.emit("backend-error",
                        String::from_utf8_lossy(&line).to_string());
                }
                CommandEvent::Error(e) => {
                    let _ = app_clone.emit("backend-error", e);
                }
                CommandEvent::Terminated(status) => {
                    let _ = app_clone.emit("backend-terminated",
                        format!("exit code: {:?}", status.code));
                    let state = app_clone.state::<SidecarState>();
                    *state.0.lock().unwrap() = None;
                    break;
                }
                _ => {}
            }
        }
    });

    let url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());
    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(500));
        if ping_backend(&url).await {
            return Ok(());
        }
    }

    Err("Backend sidecar started but did not become healthy within 10 seconds".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_runtime_state,
            get_app_data_dir,
            get_backend_config,
            get_backend_status,
            start_backend_sidecar,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main")
                    .expect("main window not found");
                window.open_devtools();
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let should_launch = if app_handle.is_packaged() {
                    #[cfg(target_os = "windows")]
                    { !is_windows_service_running("ARUSBackend") }
                    #[cfg(not(target_os = "windows"))]
                    { true }
                } else {
                    true
                };

                if should_launch {
                    if let Err(e) = launch_sidecar(&app_handle).await {
                        eprintln!("[ARUS] Sidecar launch failed: {}", e);
                        let _ = app_handle.emit("backend-launch-failed", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let state = app.state::<SidecarState>();
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
