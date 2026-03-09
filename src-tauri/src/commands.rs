use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

use crate::{
    models::{
        AppSettings, AppSnapshot, AudioChunkPayload, CopilotGenerationRequest,
        CopilotGenerationResponse, Playbook, ScreenInsight, ScreenInsightPayload,
        TranscriptIngestPayload, TranscriptSegment,
    },
    provider_http,
    simulator::spawn_session_runtime,
    state::{AppState, ProviderConfigPatch},
};
use chrono::Utc;
use uuid::Uuid;

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
    _app: AppHandle,
    state: State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> Result<AppSnapshot, String> {
    let snapshot = state.update_settings(settings)?;
    state.emit_snapshot(&_app)?;
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

#[tauri::command]
pub async fn ingest_transcript_segment(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    payload: TranscriptIngestPayload,
    playbooks: Vec<Playbook>,
) -> Result<AppSnapshot, String> {
    let segment = TranscriptSegment {
        id: Uuid::new_v4().to_string(),
        speaker: payload.speaker,
        text: payload.text,
        timestamp: Utc::now().to_rfc3339(),
        confidence: payload.confidence.unwrap_or(0.98),
    };

    let snapshot = state.ingest_transcript_segment(segment)?;
    let request = build_generation_request(&snapshot, playbooks);
    let response = match provider_http::generate_copilot_preview(&request).await {
        Ok(response) => response,
        Err(_) => state.generate_copilot_preview(request)?,
    };
    let snapshot = state.apply_copilot_generation(response)?;
    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn ingest_screen_insight(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    payload: ScreenInsightPayload,
    playbooks: Vec<Playbook>,
) -> Result<AppSnapshot, String> {
    let insight = ScreenInsight {
        id: Uuid::new_v4().to_string(),
        headline: payload.headline,
        detail: payload.detail,
        captured_at: Utc::now().format("%H:%M:%S").to_string(),
    };

    let snapshot = state.ingest_screen_insight(insight)?;
    let request = build_generation_request(&snapshot, playbooks);
    let response = match provider_http::generate_copilot_preview(&request).await {
        Ok(response) => response,
        Err(_) => state.generate_copilot_preview(request)?,
    };
    let snapshot = state.apply_copilot_generation(response)?;
    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn transcribe_audio_chunk(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    payload: AudioChunkPayload,
    playbooks: Vec<Playbook>,
) -> Result<AppSnapshot, String> {
    let snapshot = state.snapshot();
    let provider = snapshot
        .providers
        .iter()
        .find(|provider| provider.provider_id == snapshot.settings.ai_provider && provider.enabled)
        .cloned()
        .ok_or_else(|| format!("No enabled provider config found for {}", snapshot.settings.ai_provider))?;

    let text = provider_http::transcribe_audio_chunk(&provider, &snapshot.settings, &payload).await?;
    let segment = TranscriptSegment {
        id: Uuid::new_v4().to_string(),
        speaker: payload.speaker_hint.unwrap_or_else(|| "You".to_string()),
        text,
        timestamp: Utc::now().to_rfc3339(),
        confidence: 0.98,
    };

    let snapshot = state.ingest_transcript_segment(segment)?;
    let request = build_generation_request(&snapshot, playbooks);
    let response = match provider_http::generate_copilot_preview(&request).await {
        Ok(response) => response,
        Err(_) => state.generate_copilot_preview(request)?,
    };
    let snapshot = state.apply_copilot_generation(response)?;
    state.emit_snapshot(&app)?;
    Ok(snapshot)
}

fn build_generation_request(snapshot: &AppSnapshot, playbooks: Vec<Playbook>) -> CopilotGenerationRequest {
    CopilotGenerationRequest {
        settings: snapshot.settings.clone(),
        providers: snapshot.providers.clone(),
        playbooks,
        transcript: snapshot.session.transcript.clone(),
        screen_context: snapshot.session.screen_context.clone(),
    }
}
