use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

use crate::{
    models::{AppSettings, AppSnapshot, CopilotGenerationRequest, CopilotGenerationResponse},
    provider_http,
    simulator::spawn_session_runtime,
    state::{AppState, ProviderConfigPatch},
};

#[tauri::command]
pub async fn get_app_snapshot(state: State<'_, Arc<AppState>>) -> Result<AppSnapshot, String> {
    Ok(state.snapshot())
}

#[tauri::command]
pub async fn start_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<AppSnapshot, String> {
    let generation = state.start_session()?;
    state.emit_snapshot(&app)?;
    spawn_session_runtime(app, state.inner().clone(), generation);
    Ok(state.snapshot())
}

#[tauri::command]
pub async fn stop_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<AppSnapshot, String> {
    let snapshot = state.stop_session()?;
    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn toggle_overlay(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<AppSnapshot, String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "overlay window not found".to_string())?;
    let visible = !window.is_visible().map_err(|err| err.to_string())?;

    if visible {
        window.show().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
    } else {
        window.hide().map_err(|err| err.to_string())?;
    }

    state.set_overlay_visible(visible)?;
    state.emit_snapshot(&app)?;
    Ok(state.snapshot())
}

#[tauri::command]
pub async fn toggle_main_window(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    if window.is_visible().map_err(|err| err.to_string())? {
        window.hide().map_err(|err| err.to_string())?;
    } else {
        window.show().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
    }

    state.emit_snapshot(&app)?;
    Ok(())
}

#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> Result<AppSnapshot, String> {
    let snapshot = state.update_settings(settings)?;

    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.set_opacity(snapshot.settings.overlay_opacity);
    }

    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn update_provider_config(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    provider_id: String,
    patch: ProviderConfigPatch,
) -> Result<AppSnapshot, String> {
    let snapshot = state.update_provider_config(&provider_id, patch)?;
    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn test_provider_connection(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    provider_id: String,
) -> Result<AppSnapshot, String> {
    let snapshot = match state.provider_config(&provider_id) {
        Ok(provider) => match provider_http::test_provider_connection(&provider).await {
            Ok(status) => state.apply_provider_status(&provider_id, status)?,
            Err(_) => state.test_provider_connection(&provider_id)?,
        },
        Err(_) => state.test_provider_connection(&provider_id)?,
    };
    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn generate_copilot_preview(
    state: State<'_, Arc<AppState>>,
    request: CopilotGenerationRequest,
) -> Result<CopilotGenerationResponse, String> {
    match provider_http::generate_copilot_preview(&request).await {
        Ok(response) => Ok(response),
        Err(_) => state.generate_copilot_preview(request),
    }
}
