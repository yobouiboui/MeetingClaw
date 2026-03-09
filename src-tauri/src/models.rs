use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSegment {
    pub id: String,
    pub speaker: String,
    pub text: String,
    pub timestamp: String,
    pub confidence: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionCard {
    pub id: String,
    pub title: String,
    pub body: String,
    pub r#type: String,
    pub priority: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenInsight {
    pub id: String,
    pub headline: String,
    pub detail: String,
    pub captured_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingRecord {
    pub id: String,
    pub title: String,
    pub started_at: String,
    pub ended_at: String,
    pub summary: String,
    pub follow_up_email: String,
    pub transcript_preview: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hotkeys {
    pub toggle_session: String,
    pub toggle_overlay: String,
    pub toggle_main_window: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub preferred_language: String,
    pub ai_provider: String,
    pub local_mode: bool,
    pub overlay_opacity: f64,
    pub auto_launch: bool,
    pub meeting_mode: String,
    pub hotkeys: Hotkeys,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            preferred_language: "fr".to_string(),
            ai_provider: "OpenAI".to_string(),
            local_mode: true,
            overlay_opacity: 0.88,
            auto_launch: false,
            meeting_mode: "general".to_string(),
            hotkeys: Hotkeys {
                toggle_session: "CommandOrControl+Shift+Enter".to_string(),
                toggle_overlay: "CommandOrControl+Shift+O".to_string(),
                toggle_main_window: "CommandOrControl+Shift+M".to_string(),
            },
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub provider_id: String,
    pub enabled: bool,
    pub endpoint: String,
    pub model: String,
    pub api_key_hint: String,
    pub auth_mode: String,
    pub supports_vision: bool,
    pub supports_streaming: bool,
    pub last_checked_at: Option<String>,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionPerformance {
    pub latency_ms: u32,
    pub transcription_accuracy: u32,
    pub audio_pipeline: String,
    pub context_pipeline: String,
}

impl Default for SessionPerformance {
    fn default() -> Self {
        Self {
            latency_ms: 220,
            transcription_accuracy: 95,
            audio_pipeline: "Microphone -> chunker -> STT adapter".to_string(),
            context_pipeline: "Screenshot queue -> OCR adapter -> context ranker".to_string(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub active: bool,
    pub session_id: Option<String>,
    pub started_at: Option<String>,
    pub overlay_visible: bool,
    pub transcript: Vec<TranscriptSegment>,
    pub suggestions: Vec<SuggestionCard>,
    pub screen_context: Vec<ScreenInsight>,
    pub live_summary: String,
    pub notes: String,
    pub email_draft: String,
    pub performance: SessionPerformance,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            active: false,
            session_id: None,
            started_at: None,
            overlay_visible: false,
            transcript: Vec::new(),
            suggestions: vec![SuggestionCard {
                id: "boot".to_string(),
                title: "Ready for next meeting".to_string(),
                body: "Start a session to stream transcript, live answers and follow-up drafts into the overlay."
                    .to_string(),
                r#type: "summary".to_string(),
                priority: "medium".to_string(),
            }],
            screen_context: vec![ScreenInsight {
                id: "initial-screen".to_string(),
                headline: "Screen context queue idle".to_string(),
                detail: "The Windows capture pipeline is ready for screenshot, OCR and semantic extraction adapters."
                    .to_string(),
                captured_at: "Standby".to_string(),
            }],
            live_summary: "MeetingClaw is waiting for a meeting to begin.".to_string(),
            notes: "- Agenda\n- Key stakeholders\n- Next actions".to_string(),
            email_draft: "Subject: Follow-up\n\nHi team,\n\nThanks for the discussion today.\n".to_string(),
            performance: SessionPerformance::default(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub runtime_mode: String,
    pub platform_target: String,
    pub latency_budget_ms: u32,
    pub cpu_budget_active_percent: u32,
}

impl Default for Diagnostics {
    fn default() -> Self {
        Self {
            runtime_mode: "Windows desktop".to_string(),
            platform_target: "windows-x86_64".to_string(),
            latency_budget_ms: 300,
            cpu_budget_active_percent: 30,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub settings: AppSettings,
    pub providers: Vec<ProviderConfig>,
    pub session: SessionState,
    pub history: Vec<MeetingRecord>,
    pub diagnostics: Diagnostics,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopilotGenerationRequest {
    pub settings: AppSettings,
    pub providers: Vec<ProviderConfig>,
    pub playbooks: Vec<Playbook>,
    pub transcript: Vec<TranscriptSegment>,
    pub screen_context: Vec<ScreenInsight>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopilotGenerationResponse {
    pub provider_id: String,
    pub suggestions: Vec<SuggestionCard>,
    pub live_summary: String,
    pub notes: String,
    pub email_draft: String,
    pub performance: SessionPerformance,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptIngestPayload {
    pub speaker: String,
    pub text: String,
    pub confidence: Option<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenInsightPayload {
    pub headline: String,
    pub detail: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChunkPayload {
    pub audio_base64: String,
    pub mime_type: String,
    pub file_name: Option<String>,
    pub speaker_hint: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playbook {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub instructions: String,
    pub tags: Vec<String>,
    pub active: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub settings: AppSettings,
    pub providers: Vec<ProviderConfig>,
    pub history: Vec<MeetingRecord>,
}
