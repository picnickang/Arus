use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde::Serialize;
use std::env;
use std::sync::Mutex;
use std::time::Duration;
use tokio::time::sleep;

pub struct SidecarState(pub Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

#[derive(Serialize, Clone)]
pub struct AppInfo {
    version: String,
    name: String,
    identifier: String,
}

#[derive(Serialize, Clone)]
pub struct RuntimeState {
    packaged: bool,
    debug: bool,
    platform: String,
    arch: String,
}

#[derive(Serialize, Clone)]
pub struct BackendConfig {
    url: String,
    mode: String,
}

#[derive(Serialize, Clone)]
pub struct BackendStatus {
    running: bool,
    mode: String,
    url: String,
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> AppInfo {
    let config = app.config();
    AppInfo {
        version: config.version.clone().unwrap_or_else(|| "1.0.0".into()),
        name: config.product_name.clone().unwrap_or_else(|| "ARUS".into()),
        identifier: config.identifier.clone(),
    }
}

#[tauri::command]
pub fn get_runtime_state(app: AppHandle) -> RuntimeState {
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

    RuntimeState {
        packaged,
        debug,
        platform: platform.into(),
        arch: arch.into(),
    }
}

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))
}

#[tauri::command]
pub fn get_backend_config() -> BackendConfig {
    let url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());
    let mode = env::var("ARUS_MODE").unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            "development".into()
        } else {
            "production".into()
        }
    });
    BackendConfig { url, mode }
}

#[tauri::command]
pub async fn get_backend_status(app: AppHandle) -> BackendStatus {
    let url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());

    #[cfg(target_os = "windows")]
    if service_is_running("ARUSBackend") {
        return BackendStatus {
            running: true,
            mode: "service".into(),
            url,
        };
    }

    {
        let state = app.state::<SidecarState>();
        if state.0.lock().unwrap().is_some() {
            return BackendStatus {
                running: true,
                mode: "sidecar".into(),
                url,
            };
        }
    }

    if ping_backend(&url).await {
        return BackendStatus {
            running: true,
            mode: "remote".into(),
            url,
        };
    }

    BackendStatus {
        running: false,
        mode: "offline".into(),
        url,
    }
}

#[tauri::command]
pub async fn start_backend_sidecar(app: AppHandle) -> Result<(), String> {
    launch_sidecar(&app).await
}

#[cfg(target_os = "windows")]
fn service_is_running(name: &str) -> bool {
    use std::process::Command;
    match Command::new("sc").args(["query", name]).output() {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout);
            text.contains("RUNNING")
        }
        Err(_) => false,
    }
}

async fn ping_backend(base_url: &str) -> bool {
    let url = format!("{}/api/healthz", base_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .danger_accept_invalid_certs(false)
        .build();

    match client {
        Ok(c) => c.get(&url).send().await.map(|r| r.status().is_success()).unwrap_or(false),
        Err(_) => false,
    }
}

async fn launch_sidecar(app: &AppHandle) -> Result<(), String> {
    {
        let state = app.state::<SidecarState>();
        if state.0.lock().unwrap().is_some() {
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    if app.is_packaged() && service_is_running("ARUSBackend") {
        return Ok(());
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;

    std::fs::create_dir_all(&app_data)
        .map_err(|e| format!("Cannot create app data dir: {}", e))?;

    let db_path = app_data.join("vessel-local.db");
    let log_dir = app_data.join("logs");
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Cannot create log dir: {}", e))?;

    let backend_url = env::var("ARUS_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:5000".into());

    let cmd = app
        .shell()
        .sidecar("arus-server")
        .map_err(|e| format!("Sidecar binary not found: {}", e))?
        .env("NODE_ENV",        if cfg!(debug_assertions) { "development" } else { "production" })
        .env("PORT",            "5000")
        .env("ARUS_BACKEND_URL", &backend_url)
        .env("DATABASE_PATH",   db_path.to_string_lossy().as_ref())
        .env("DEPLOYMENT_MODE", "VESSEL")
        .env("LOCAL_MODE",      "true");

    let (mut rx, child) = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    {
        let state = app.state::<SidecarState>();
        *state.0.lock().unwrap() = Some(child);
    }

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let _ = app_clone.emit(
                        "backend-log",
                        String::from_utf8_lossy(&bytes).trim().to_string(),
                    );
                }
                CommandEvent::Stderr(bytes) => {
                    let _ = app_clone.emit(
                        "backend-error",
                        String::from_utf8_lossy(&bytes).trim().to_string(),
                    );
                }
                CommandEvent::Error(msg) => {
                    let _ = app_clone.emit("backend-error", msg);
                }
                CommandEvent::Terminated(status) => {
                    let _ = app_clone.emit(
                        "backend-terminated",
                        format!("exit {:?}", status.code),
                    );
                    let state = app_clone.state::<SidecarState>();
                    *state.0.lock().unwrap() = None;
                    break;
                }
                _ => {}
            }
        }
    });

    for attempt in 0..30 {
        sleep(Duration::from_millis(500)).await;
        if ping_backend(&backend_url).await {
            return Ok(());
        }
        if attempt == 10 {
            let _ = app.emit("backend-log", "Still starting — please wait…".to_string());
        }
    }

    Err("Backend sidecar did not become healthy within 15 seconds".into())
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
                let window = app
                    .get_webview_window("main")
                    .expect("main window not found");
                window.open_devtools();
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let should_launch = {
                    #[cfg(target_os = "windows")]
                    {
                        !(handle.is_packaged() && service_is_running("ARUSBackend"))
                    }
                    #[cfg(not(target_os = "windows"))]
                    {
                        true
                    }
                };

                if should_launch {
                    if let Err(e) = launch_sidecar(&handle).await {
                        eprintln!("[ARUS] Sidecar launch failed: {}", e);
                        let _ = handle.emit("backend-launch-failed", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.app_handle().state::<SidecarState>();
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
