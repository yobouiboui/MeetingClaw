use std::{sync::Arc, time::Duration};

use chrono::Utc;
use tauri::AppHandle;
use tokio::time::sleep;
use uuid::Uuid;

use crate::{
    models::{ScreenInsight, SuggestionCard, TranscriptSegment},
    state::AppState,
};

const TRANSCRIPT_SCRIPT: [(&str, &str); 5] = [
    (
        "Customer",
        "We need to reduce onboarding friction for enterprise admins.",
    ),
    (
        "You",
        "We can collapse setup into a guided flow with SSO-first defaults.",
    ),
    (
        "Customer",
        "My concern is rollout risk across multiple teams.",
    ),
    (
        "You",
        "We should propose a phased pilot with success metrics and rollback checkpoints.",
    ),
    (
        "Customer",
        "If the pilot works, what happens after week two?",
    ),
];

const SUGGESTION_SCRIPT: [(&str, &str, &str, &str); 4] = [
    (
        "Anchor the answer",
        "Lead with reduced rollout risk, then propose a phased pilot and explicit success metrics.",
        "reply",
        "high",
    ),
    (
        "Handle the objection",
        "Acknowledge the risk directly, then commit to one team, one workflow and a weekly review loop.",
        "objection",
        "high",
    ),
    (
        "Explain the screen",
        "The slide implies admin efficiency is the KPI. Tie your answer to time-to-first-value and support load.",
        "summary",
        "medium",
    ),
    (
        "Follow-up angle",
        "Offer a short written rollout plan with milestones, owners and a week-two checkpoint.",
        "follow-up",
        "medium",
    ),
];

pub fn spawn_session_runtime(app: AppHandle, state: Arc<AppState>, generation: u64) {
    tauri::async_runtime::spawn(async move {
        for (index, (speaker, text)) in TRANSCRIPT_SCRIPT.iter().enumerate() {
            if !state.is_generation_active(generation) {
                break;
            }

            let segment = TranscriptSegment {
                id: Uuid::new_v4().to_string(),
                speaker: (*speaker).to_string(),
                text: (*text).to_string(),
                timestamp: Utc::now().to_rfc3339(),
                confidence: 0.97,
            };
            let insight = ScreenInsight {
                id: Uuid::new_v4().to_string(),
                headline: format!("Context pass {}", index + 1),
                detail: format!(
                    "Detected meeting content around topic: {}",
                    text.split_whitespace()
                        .take(6)
                        .collect::<Vec<_>>()
                        .join(" ")
                ),
                captured_at: Utc::now().format("%H:%M:%S").to_string(),
            };
            let suggestion_source = SUGGESTION_SCRIPT[index.min(SUGGESTION_SCRIPT.len() - 1)];
            let suggestion = SuggestionCard {
                id: Uuid::new_v4().to_string(),
                title: suggestion_source.0.to_string(),
                body: suggestion_source.1.to_string(),
                r#type: suggestion_source.2.to_string(),
                priority: suggestion_source.3.to_string(),
            };

            if state
                .append_live_data(generation, segment, suggestion, insight)
                .is_err()
            {
                break;
            }

            let _ = state.emit_snapshot(&app);
            sleep(Duration::from_secs(2)).await;
        }
    });
}
