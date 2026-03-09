use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::models::{
    AppSettings, AppSnapshot, CopilotGenerationRequest, CopilotGenerationResponse, Diagnostics,
    MeetingRecord, PersistedState, ProviderConfig, ScreenInsight, SessionPerformance, SessionState,
    SuggestionCard, TranscriptSegment,
};
use crate::storage::HistoryStore;

const SNAPSHOT_EVENT: &str = "meetingclaw://snapshot";

#[derive(Clone, Default)]
struct RuntimeState {
    settings: AppSettings,
    providers: Vec<ProviderConfig>,
    history: Vec<MeetingRecord>,
    session: SessionState,
    generation: u64,
}

pub struct AppState {
    runtime: Mutex<RuntimeState>,
    history_store: HistoryStore,
    storage_path: PathBuf,
}

impl AppState {
    pub fn load() -> Result<Arc<Self>, String> {
        let mut base_dir =
            dirs::data_local_dir().ok_or_else(|| "unable to resolve LocalAppData".to_string())?;
        base_dir.push("MeetingClaw");
        fs::create_dir_all(&base_dir).map_err(|err| err.to_string())?;

        let storage_path = base_dir.join("state.json");
        let history_db_path = base_dir.join("history.db");
        let persisted = if storage_path.exists() {
            let raw = fs::read_to_string(&storage_path).map_err(|err| err.to_string())?;
            serde_json::from_str::<PersistedState>(&raw).unwrap_or_default()
        } else {
            PersistedState::default()
        };
        let history_store = HistoryStore::new(&history_db_path)?;
        let providers = merge_provider_configs(&persisted.settings, &persisted.providers);
        let settings = persisted.settings;
        let history = history_store
            .load_history(12)
            .unwrap_or_else(|_| persisted.history);

        Ok(Arc::new(Self {
            runtime: Mutex::new(RuntimeState {
                providers,
                settings,
                history,
                session: SessionState::default(),
                generation: 0,
            }),
            history_store,
            storage_path,
        }))
    }

    pub fn snapshot(&self) -> AppSnapshot {
        let runtime = self.runtime.lock().expect("state poisoned");
        AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        }
    }

    pub fn start_session(&self) -> Result<u64, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;
        runtime.generation += 1;
        runtime.session = SessionState {
            active: true,
            session_id: Some(Uuid::new_v4().to_string()),
            started_at: Some(Utc::now().to_rfc3339()),
            overlay_visible: runtime.session.overlay_visible,
            transcript: Vec::new(),
            suggestions: Vec::new(),
            screen_context: Vec::new(),
            live_summary:
                "Meeting started. Waiting for enough transcript and screen context to generate the first answer."
                    .to_string(),
            notes: "- Meeting started\n- Listening for agenda\n- Capturing first action items".to_string(),
            email_draft: "Subject: Meeting follow-up\n\nHi team,\n\nThanks for the conversation today.\n"
                .to_string(),
            performance: runtime.session.performance.clone(),
        };
        Ok(runtime.generation)
    }

    pub fn stop_session(&self) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;

        if runtime.session.active {
            let transcript_preview = runtime
                .session
                .transcript
                .iter()
                .map(|segment| segment.text.as_str())
                .take(3)
                .collect::<Vec<_>>()
                .join(" ");
            let session_id = runtime
                .session
                .session_id
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string());
            let started_at = runtime
                .session
                .started_at
                .clone()
                .unwrap_or_else(|| Utc::now().to_rfc3339());
            let summary = runtime.session.live_summary.clone();
            let follow_up_email = runtime.session.email_draft.clone();
            let title = format!("Meeting {}", Utc::now().format("%d/%m %H:%M"));
            let ended_at = Utc::now().to_rfc3339();
            let record = MeetingRecord {
                id: session_id,
                title,
                started_at,
                ended_at,
                summary,
                follow_up_email,
                transcript_preview,
            };
            self.history_store.insert_meeting(&record)?;
            runtime.history = self.history_store.load_history(12)?;
        }

        runtime.generation += 1;
        runtime.session.active = false;
        runtime.session.live_summary =
            "Meeting ended. Notes and follow-up draft have been archived to the local session history."
                .to_string();
        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn update_settings(&self, settings: AppSettings) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;
        runtime.settings = settings;
        runtime.providers = merge_provider_configs(&runtime.settings, &runtime.providers);
        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn update_provider_config(
        &self,
        provider_id: &str,
        patch: ProviderConfigPatch,
    ) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;

        let provider = runtime
            .providers
            .iter_mut()
            .find(|provider| provider.provider_id == provider_id)
            .ok_or_else(|| format!("provider {} not found", provider_id))?;

        if let Some(enabled) = patch.enabled {
            provider.enabled = enabled;
        }
        if let Some(endpoint) = patch.endpoint {
            provider.endpoint = endpoint;
        }
        if let Some(model) = patch.model {
            provider.model = model;
        }
        if let Some(api_key_hint) = patch.api_key_hint {
            provider.api_key_hint = api_key_hint;
        }

        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn test_provider_connection(&self, provider_id: &str) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;

        let provider = runtime
            .providers
            .iter_mut()
            .find(|provider| provider.provider_id == provider_id)
            .ok_or_else(|| format!("provider {} not found", provider_id))?;

        provider.status = evaluate_provider_status(provider);
        provider.last_checked_at = Some(Utc::now().to_rfc3339());

        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn provider_config(&self, provider_id: &str) -> Result<ProviderConfig, String> {
        let runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;

        runtime
            .providers
            .iter()
            .find(|provider| provider.provider_id == provider_id)
            .cloned()
            .ok_or_else(|| format!("provider {} not found", provider_id))
    }

    pub fn apply_provider_status(
        &self,
        provider_id: &str,
        status: String,
    ) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;

        let provider = runtime
            .providers
            .iter_mut()
            .find(|provider| provider.provider_id == provider_id)
            .ok_or_else(|| format!("provider {} not found", provider_id))?;

        provider.status = status;
        provider.last_checked_at = Some(Utc::now().to_rfc3339());

        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn generate_copilot_preview(
        &self,
        request: CopilotGenerationRequest,
    ) -> Result<CopilotGenerationResponse, String> {
        let provider = request
            .providers
            .iter()
            .find(|provider| provider.provider_id == request.settings.ai_provider)
            .cloned()
            .unwrap_or_else(|| {
                merge_provider_configs(&request.settings, &request.providers)
                    .into_iter()
                    .next()
                    .unwrap_or_else(|| default_provider_configs(&request.settings)[0].clone())
            });

        let latest_transcript = request
            .transcript
            .last()
            .map(|segment| segment.text.clone())
            .unwrap_or_else(|| "No transcript captured yet.".to_string());
        let latest_context = request
            .screen_context
            .first()
            .map(|insight| insight.detail.clone())
            .unwrap_or_else(|| "No screen context captured yet.".to_string());
        let active_playbooks = request
            .playbooks
            .iter()
            .filter(|playbook| playbook.active)
            .map(|playbook| format!("{}: {}", playbook.name, playbook.instructions))
            .collect::<Vec<_>>();
        let playbook_text = if active_playbooks.is_empty() {
            "No active playbook. Use the base assistant behavior.".to_string()
        } else {
            active_playbooks.join(" ")
        };

        let routing_mode = if request.settings.local_mode {
            "Local-first routing"
        } else {
            "Cloud routing"
        };
        let provider_route = format!("{} | {} | {}", provider.provider_id, provider.model, routing_mode);

        Ok(CopilotGenerationResponse {
            provider_id: provider.provider_id.clone(),
            suggestions: vec![
                SuggestionCard {
                    id: Uuid::new_v4().to_string(),
                    title: format!("{} answer framing", provider.provider_id),
                    body: format!(
                        "Lead with the outcome, reference \"{}\", then anchor the response with: {}",
                        latest_transcript, playbook_text
                    ),
                    r#type: "reply".to_string(),
                    priority: "high".to_string(),
                },
                SuggestionCard {
                    id: Uuid::new_v4().to_string(),
                    title: "Context cue".to_string(),
                    body: format!(
                        "Visible context suggests: {}. Route the answer using {}.",
                        latest_context, provider_route
                    ),
                    r#type: "summary".to_string(),
                    priority: "medium".to_string(),
                },
                SuggestionCard {
                    id: Uuid::new_v4().to_string(),
                    title: "Follow-up move".to_string(),
                    body: format!(
                        "Close with a clear owner, timeline and next step aligned to {} mode and {}.",
                        request.settings.meeting_mode, routing_mode
                    ),
                    r#type: "follow-up".to_string(),
                    priority: "medium".to_string(),
                },
            ],
            live_summary: format!(
                "Mode: {}. Latest transcript: {} Provider route: {}. Prompt steering: {}",
                request.settings.meeting_mode, latest_transcript, provider_route, playbook_text
            ),
            notes: format!(
                "- Current meeting signal\n  {}\n- Screen cue\n  {}\n- Provider route\n  {}\n- Active playbooks\n  {}",
                latest_transcript,
                latest_context,
                provider_route,
                request
                    .playbooks
                    .iter()
                    .filter(|playbook| playbook.active)
                    .map(|playbook| playbook.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
            email_draft: format!(
                "Subject: Follow-up from today\n\nHi team,\n\nHere is the current recap from the {} conversation:\n- latest topic: {}\n- visible context: {}\n- provider route: {}\n- next step: confirm owner, timeline and checkpoint\n\nBest,\n",
                request.settings.meeting_mode, latest_transcript, latest_context, provider_route
            ),
            performance: SessionPerformance {
                latency_ms: estimate_provider_latency(&request.settings),
                transcription_accuracy: if provider.provider_id == "Ollama" { 93 } else { 95 },
                audio_pipeline: describe_audio_pipeline(&request.settings),
                context_pipeline: describe_context_pipeline(&request.settings, provider.supports_vision),
            },
        })
    }

    pub fn set_overlay_visible(&self, visible: bool) -> Result<(), String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;
        runtime.session.overlay_visible = visible;
        Ok(())
    }

    pub fn is_generation_active(&self, generation: u64) -> bool {
        let runtime = self.runtime.lock().expect("state poisoned");
        runtime.generation == generation && runtime.session.active
    }

    pub fn append_live_data(
        &self,
        generation: u64,
        segment: TranscriptSegment,
        suggestion: SuggestionCard,
        insight: ScreenInsight,
    ) -> Result<(), String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;
        if runtime.generation != generation || !runtime.session.active {
            return Err("session no longer active".to_string());
        }

        runtime.session.transcript.push(segment.clone());
        runtime.session.suggestions.insert(0, suggestion);
        runtime.session.suggestions.truncate(6);
        runtime.session.screen_context.insert(0, insight);
        runtime.session.screen_context.truncate(4);
        runtime.session.live_summary = format!(
            "Latest theme: {}. Suggest concise next-step language and reinforce measurable rollout control.",
            segment.text
        );
        runtime.session.notes = format!(
            "- Main concern: rollout risk\n- Suggested answer: phased pilot\n- Latest quote: {}",
            segment.text
        );
        runtime.session.email_draft = "Subject: Follow-up from today's meeting\n\nHi team,\n\nThanks again for the conversation. Here is the proposed next step:\n- phased pilot with one team\n- explicit weekly review checkpoint\n- measurable success criteria tied to onboarding time\n\nBest,\n".to_string();
        Ok(())
    }

    pub fn ingest_transcript_segment(&self, segment: TranscriptSegment) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;
        if !runtime.session.active {
            return Err("session is not active".to_string());
        }

        runtime.session.transcript.push(segment);
        runtime.session.transcript = runtime
            .session
            .transcript
            .iter()
            .rev()
            .take(120)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();

        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn ingest_screen_insight(&self, insight: ScreenInsight) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;
        if !runtime.session.active {
            return Err("session is not active".to_string());
        }

        runtime.session.screen_context.insert(0, insight);
        runtime.session.screen_context.truncate(8);

        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn apply_copilot_generation(
        &self,
        response: CopilotGenerationResponse,
    ) -> Result<AppSnapshot, String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "state poisoned".to_string())?;

        runtime.session.suggestions = response.suggestions;
        runtime.session.live_summary = response.live_summary;
        runtime.session.notes = response.notes;
        runtime.session.email_draft = response.email_draft;
        runtime.session.performance = response.performance;

        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
        })
    }

    pub fn search_history(&self, query: &str, limit: usize) -> Result<Vec<MeetingRecord>, String> {
        self.history_store.search_history(query, limit)
    }

    pub fn emit_snapshot(&self, app: &AppHandle) -> Result<(), String> {
        let snapshot = self.snapshot();
        app.emit(SNAPSHOT_EVENT, snapshot)
            .map_err(|err| err.to_string())
    }

    fn persist(&self, runtime: &RuntimeState) -> Result<(), String> {
        let persisted = PersistedState {
            settings: runtime.settings.clone(),
            providers: runtime.providers.clone(),
            history: Vec::new(),
        };
        let payload = serialize_pretty(&persisted)?;
        fs::write(&self.storage_path, payload).map_err(|err| err.to_string())
    }
}

#[derive(Clone, Debug, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigPatch {
    pub enabled: Option<bool>,
    pub endpoint: Option<String>,
    pub model: Option<String>,
    pub api_key_hint: Option<String>,
}

fn merge_provider_configs(settings: &AppSettings, providers: &[ProviderConfig]) -> Vec<ProviderConfig> {
    default_provider_configs(settings)
        .into_iter()
        .map(|default_provider| {
            providers
                .iter()
                .find(|provider| provider.provider_id == default_provider.provider_id)
                .cloned()
                .map(|provider| ProviderConfig {
                    enabled: provider.enabled,
                    endpoint: provider.endpoint,
                    model: provider.model,
                    api_key_hint: provider.api_key_hint,
                    last_checked_at: provider.last_checked_at,
                    status: provider.status,
                    ..default_provider.clone()
                })
                .unwrap_or(default_provider)
        })
        .collect()
}

fn default_provider_configs(settings: &AppSettings) -> Vec<ProviderConfig> {
    vec![
        ProviderConfig {
            provider_id: "OpenAI".to_string(),
            enabled: settings.ai_provider == "OpenAI",
            endpoint: "https://api.openai.com/v1".to_string(),
            model: "gpt-4.1-mini".to_string(),
            api_key_hint: String::new(),
            auth_mode: "Bearer API key".to_string(),
            supports_vision: true,
            supports_streaming: true,
            last_checked_at: None,
            status: "unknown".to_string(),
        },
        ProviderConfig {
            provider_id: "Claude".to_string(),
            enabled: settings.ai_provider == "Claude",
            endpoint: "https://api.anthropic.com/v1".to_string(),
            model: "claude-3-7-sonnet".to_string(),
            api_key_hint: String::new(),
            auth_mode: "API key header".to_string(),
            supports_vision: true,
            supports_streaming: true,
            last_checked_at: None,
            status: "unknown".to_string(),
        },
        ProviderConfig {
            provider_id: "Gemini".to_string(),
            enabled: settings.ai_provider == "Gemini",
            endpoint: "https://generativelanguage.googleapis.com".to_string(),
            model: "gemini-2.0-flash".to_string(),
            api_key_hint: String::new(),
            auth_mode: "API key query/header".to_string(),
            supports_vision: true,
            supports_streaming: true,
            last_checked_at: None,
            status: "unknown".to_string(),
        },
        ProviderConfig {
            provider_id: "Ollama".to_string(),
            enabled: settings.ai_provider == "Ollama" || settings.local_mode,
            endpoint: "http://127.0.0.1:11434".to_string(),
            model: "llama3.2".to_string(),
            api_key_hint: "Local daemon, no key required".to_string(),
            auth_mode: "No auth on local daemon".to_string(),
            supports_vision: false,
            supports_streaming: true,
            last_checked_at: None,
            status: "configured".to_string(),
        },
    ]
}

fn evaluate_provider_status(provider: &ProviderConfig) -> String {
    if !provider.enabled {
        return "offline".to_string();
    }

    if provider.provider_id == "Ollama" {
        return if provider.endpoint.contains("127.0.0.1") || provider.endpoint.contains("localhost") {
            "configured".to_string()
        } else {
            "offline".to_string()
        };
    }

    if provider.api_key_hint.trim().is_empty() {
        return "missing-auth".to_string();
    }

    if !provider.endpoint.starts_with("http") {
        return "offline".to_string();
    }

    "configured".to_string()
}

fn estimate_provider_latency(settings: &AppSettings) -> u32 {
    let base = match settings.ai_provider.as_str() {
        "OpenAI" => 180,
        "Claude" => 240,
        "Gemini" => 210,
        "Ollama" => 260,
        _ => 200,
    };

    if settings.local_mode && settings.ai_provider != "Ollama" {
        base.max(220) + 30
    } else {
        base
    }
}

fn describe_audio_pipeline(settings: &AppSettings) -> String {
    match settings.ai_provider.as_str() {
        "OpenAI" if settings.local_mode => "Hybrid local transcript queue with OpenAI final routing".to_string(),
        "OpenAI" => "Streaming transcript queue via remote low-latency profile".to_string(),
        "Claude" if settings.local_mode => "Hybrid local transcript queue with Claude final routing".to_string(),
        "Claude" => "Streaming transcript queue via remote high-context profile".to_string(),
        "Gemini" if settings.local_mode => "Hybrid local transcript queue with Gemini final routing".to_string(),
        "Gemini" => "Streaming transcript queue via remote multimodal profile".to_string(),
        "Ollama" => "Local transcript queue for privacy-preserving inference".to_string(),
        _ => "Microphone -> chunker -> STT adapter".to_string(),
    }
}

fn describe_context_pipeline(settings: &AppSettings, supports_vision: bool) -> String {
    if !supports_vision {
        return "Screenshot queue -> OCR adapter -> text-only context ranker".to_string();
    }

    match settings.ai_provider.as_str() {
        "OpenAI" if settings.local_mode => "Hybrid local OCR pass with OpenAI context completion".to_string(),
        "OpenAI" => "Vision summary and OCR routed through remote context pass".to_string(),
        "Claude" if settings.local_mode => "Hybrid local OCR pass with Claude context completion".to_string(),
        "Claude" => "Long-context screen synthesis for discussion state".to_string(),
        "Gemini" if settings.local_mode => "Hybrid local OCR pass with Gemini context completion".to_string(),
        "Gemini" => "Slide-aware screenshot extraction and summarization".to_string(),
        _ => "Screenshot queue -> OCR adapter -> context ranker".to_string(),
    }
}

fn serialize_pretty<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string_pretty(value).map_err(|err| err.to_string())
}
