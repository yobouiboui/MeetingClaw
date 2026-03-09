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
    AppSettings, AppSnapshot, Diagnostics, MeetingRecord, PersistedState, ScreenInsight,
    SessionState, SuggestionCard, TranscriptSegment,
};

const SNAPSHOT_EVENT: &str = "meetingclaw://snapshot";

#[derive(Clone, Default)]
struct RuntimeState {
    settings: AppSettings,
    history: Vec<MeetingRecord>,
    session: SessionState,
    generation: u64,
}

pub struct AppState {
    runtime: Mutex<RuntimeState>,
    storage_path: PathBuf,
}

impl AppState {
    pub fn load() -> Result<Arc<Self>, String> {
        let mut base_dir =
            dirs::data_local_dir().ok_or_else(|| "unable to resolve LocalAppData".to_string())?;
        base_dir.push("MeetingClaw");
        fs::create_dir_all(&base_dir).map_err(|err| err.to_string())?;

        let storage_path = base_dir.join("state.json");
        let persisted = if storage_path.exists() {
            let raw = fs::read_to_string(&storage_path).map_err(|err| err.to_string())?;
            serde_json::from_str::<PersistedState>(&raw).unwrap_or_default()
        } else {
            PersistedState::default()
        };

        Ok(Arc::new(Self {
            runtime: Mutex::new(RuntimeState {
                settings: persisted.settings,
                history: persisted.history,
                session: SessionState::default(),
                generation: 0,
            }),
            storage_path,
        }))
    }

    pub fn snapshot(&self) -> AppSnapshot {
        let runtime = self.runtime.lock().expect("state poisoned");
        AppSnapshot {
            settings: runtime.settings.clone(),
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
            runtime.history.insert(
                0,
                MeetingRecord {
                    id: runtime
                        .session
                        .session_id
                        .clone()
                        .unwrap_or_else(|| Uuid::new_v4().to_string()),
                    title: format!("Meeting {}", Utc::now().format("%d/%m %H:%M")),
                    started_at: runtime
                        .session
                        .started_at
                        .clone()
                        .unwrap_or_else(|| Utc::now().to_rfc3339()),
                    ended_at: Utc::now().to_rfc3339(),
                    summary: runtime.session.live_summary.clone(),
                    follow_up_email: runtime.session.email_draft.clone(),
                    transcript_preview,
                },
            );
            runtime.history.truncate(12);
        }

        runtime.generation += 1;
        runtime.session.active = false;
        runtime.session.live_summary =
            "Meeting ended. Notes and follow-up draft have been archived to the local session history."
                .to_string();
        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
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
        self.persist(&runtime)?;
        Ok(AppSnapshot {
            settings: runtime.settings.clone(),
            session: runtime.session.clone(),
            history: runtime.history.clone(),
            diagnostics: Diagnostics::default(),
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

    pub fn emit_snapshot(&self, app: &AppHandle) -> Result<(), String> {
        let snapshot = self.snapshot();
        app.emit(SNAPSHOT_EVENT, snapshot)
            .map_err(|err| err.to_string())
    }

    fn persist(&self, runtime: &RuntimeState) -> Result<(), String> {
        let persisted = PersistedState {
            settings: runtime.settings.clone(),
            history: runtime.history.clone(),
        };
        let payload = serialize_pretty(&persisted)?;
        fs::write(&self.storage_path, payload).map_err(|err| err.to_string())
    }
}

fn serialize_pretty<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string_pretty(value).map_err(|err| err.to_string())
}
