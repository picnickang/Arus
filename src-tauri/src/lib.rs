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
