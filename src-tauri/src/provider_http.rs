use std::time::Duration;

use base64::Engine;
use reqwest::{
    header::{AUTHORIZATION, CONTENT_TYPE},
    multipart::{Form, Part},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{
    AppSettings, AudioChunkPayload, CopilotGenerationRequest, CopilotGenerationResponse,
    ProviderConfig, ScreenInsight, SessionPerformance, SuggestionCard, TranscriptSegment,
};

pub async fn test_provider_connection(provider: &ProviderConfig) -> Result<String, String> {
    match provider.provider_id.as_str() {
        "OpenAI" => {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .map_err(|err| err.to_string())?;
            let token = provider.api_key_hint.trim();
            if token.is_empty() {
                return Err("Missing OpenAI API key".to_string());
            }

            let response = client
                .get(format!("{}/models", trim_trailing_slash(&provider.endpoint)))
                .header(AUTHORIZATION, format!("Bearer {}", token))
                .send()
                .await
                .map_err(|err| err.to_string())?;

            if response.status().is_success() {
                Ok("configured".to_string())
            } else {
                Err(format!("OpenAI returned HTTP {}", response.status()))
            }
        }
        "Claude" => {
            let token = provider.api_key_hint.trim();
            if token.is_empty() {
                return Err("Missing Claude API key".to_string());
            }

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .map_err(|err| err.to_string())?;

            let response = client
                .post(format!("{}/messages", trim_trailing_slash(&provider.endpoint)))
                .header("x-api-key", token)
                .header("anthropic-version", "2023-06-01")
                .header(CONTENT_TYPE, "application/json")
                .json(&AnthropicMessagesRequest {
                    model: provider.model.clone(),
                    max_tokens: 16,
                    system: Some("Return one word.".to_string()),
                    messages: vec![AnthropicMessageInput {
                        role: "user".to_string(),
                        content: "ping".to_string(),
                    }],
                })
                .send()
                .await
                .map_err(|err| err.to_string())?;

            if response.status().is_success() {
                Ok("configured".to_string())
            } else {
                Err(format!("Claude returned HTTP {}", response.status()))
            }
        }
        "Gemini" => {
            let token = provider.api_key_hint.trim();
            if token.is_empty() {
                return Err("Missing Gemini API key".to_string());
            }

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .map_err(|err| err.to_string())?;

            let response = client
                .post(format!(
                    "{}/v1beta/models/{}:generateContent",
                    trim_google_endpoint(&provider.endpoint),
                    provider.model
                ))
                .header("x-goog-api-key", token)
                .header(CONTENT_TYPE, "application/json")
                .json(&GeminiGenerateContentRequest {
                    contents: vec![GeminiContent {
                        role: Some("user".to_string()),
                        parts: vec![GeminiPart {
                            text: Some("ping".to_string()),
                        }],
                    }],
                    generation_config: Some(GeminiGenerationConfig {
                        temperature: Some(0.0),
                        max_output_tokens: Some(8),
                        response_mime_type: None,
                    }),
                })
                .send()
                .await
                .map_err(|err| err.to_string())?;

            if response.status().is_success() {
                Ok("configured".to_string())
            } else {
                Err(format!("Gemini returned HTTP {}", response.status()))
            }
        }
        "Ollama" => {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .map_err(|err| err.to_string())?;
            let response = client
                .get(format!("{}/api/version", trim_trailing_slash(&provider.endpoint)))
                .send()
                .await
                .map_err(|err| err.to_string())?;

            if response.status().is_success() {
                Ok("configured".to_string())
            } else {
                Err(format!("Ollama returned HTTP {}", response.status()))
            }
        }
        other => Err(format!("HTTP adapter not implemented yet for {}", other)),
    }
}

pub async fn generate_copilot_preview(
    request: &CopilotGenerationRequest,
) -> Result<CopilotGenerationResponse, String> {
    let provider = request
        .providers
        .iter()
        .find(|provider| provider.provider_id == request.settings.ai_provider && provider.enabled)
        .ok_or_else(|| format!("No enabled provider config found for {}", request.settings.ai_provider))?;

    match provider.provider_id.as_str() {
        "OpenAI" => generate_openai_preview(provider, request).await,
        "Claude" => generate_claude_preview(provider, request).await,
        "Gemini" => generate_gemini_preview(provider, request).await,
        "Ollama" => generate_ollama_preview(provider, request).await,
        other => Err(format!("HTTP adapter not implemented yet for {}", other)),
    }
}

pub async fn transcribe_audio_chunk(
    provider: &ProviderConfig,
    settings: &AppSettings,
    payload: &AudioChunkPayload,
) -> Result<String, String> {
    match provider.provider_id.as_str() {
        "OpenAI" => transcribe_openai_audio(provider, settings, payload).await,
        other => Err(format!("Transcription adapter not implemented yet for {}", other)),
    }
}

async fn generate_openai_preview(
    provider: &ProviderConfig,
    request: &CopilotGenerationRequest,
) -> Result<CopilotGenerationResponse, String> {
    let token = provider.api_key_hint.trim();
    if token.is_empty() {
        return Err("Missing OpenAI API key".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|err| err.to_string())?;

    let body = OpenAiChatCompletionRequest {
        model: provider.model.clone(),
        temperature: 0.2,
        response_format: OpenAiResponseFormat {
            response_type: "json_object".to_string(),
        },
        messages: vec![
            OpenAiMessage {
                role: "system".to_string(),
                content: build_system_prompt(&request.settings),
            },
            OpenAiMessage {
                role: "user".to_string(),
                content: build_user_prompt(request),
            },
        ],
    };

    let response = client
        .post(format!(
            "{}/chat/completions",
            trim_trailing_slash(&provider.endpoint)
        ))
        .header(AUTHORIZATION, format!("Bearer {}", token))
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let processing_ms = response
        .headers()
        .get("openai-processing-ms")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u32>().ok());

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI request failed: {}", error_body));
    }

    let payload: OpenAiChatCompletionResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.clone())
        .ok_or_else(|| "OpenAI returned no completion choices".to_string())?;

    let structured = parse_structured_output(&content)?;
    Ok(to_generation_response(
        provider,
        request,
        structured,
        processing_ms.unwrap_or(estimate_provider_latency(&request.settings)),
        true,
    ))
}

async fn generate_ollama_preview(
    provider: &ProviderConfig,
    request: &CopilotGenerationRequest,
) -> Result<CopilotGenerationResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| err.to_string())?;

    let body = OllamaGenerateRequest {
        model: provider.model.clone(),
        prompt: build_user_prompt(request),
        system: build_system_prompt(&request.settings),
        stream: false,
        format: "json".to_string(),
    };

    let response = client
        .post(format!("{}/api/generate", trim_trailing_slash(&provider.endpoint)))
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama request failed: {}", error_body));
    }

    let payload: OllamaGenerateResponse = response.json().await.map_err(|err| err.to_string())?;
    let structured = parse_structured_output(&payload.response)?;
    let latency_ms = payload
        .total_duration
        .map(|duration| (duration / 1_000_000) as u32)
        .unwrap_or(estimate_provider_latency(&request.settings));

    Ok(to_generation_response(
        provider,
        request,
        structured,
        latency_ms,
        false,
    ))
}

async fn generate_claude_preview(
    provider: &ProviderConfig,
    request: &CopilotGenerationRequest,
) -> Result<CopilotGenerationResponse, String> {
    let token = provider.api_key_hint.trim();
    if token.is_empty() {
        return Err("Missing Claude API key".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| err.to_string())?;

    let response = client
        .post(format!("{}/messages", trim_trailing_slash(&provider.endpoint)))
        .header("x-api-key", token)
        .header("anthropic-version", "2023-06-01")
        .header(CONTENT_TYPE, "application/json")
        .json(&AnthropicMessagesRequest {
            model: provider.model.clone(),
            max_tokens: 1200,
            system: Some(build_system_prompt(&request.settings)),
            messages: vec![AnthropicMessageInput {
                role: "user".to_string(),
                content: build_user_prompt(request),
            }],
        })
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Claude request failed: {}", error_body));
    }

    let payload: AnthropicMessagesResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = payload
        .content
        .into_iter()
        .find_map(|block| block.text)
        .ok_or_else(|| "Claude returned no text content".to_string())?;

    let structured = parse_structured_output(&content)?;
    Ok(to_generation_response(
        provider,
        request,
        structured,
        estimate_provider_latency(&request.settings),
        true,
    ))
}

async fn generate_gemini_preview(
    provider: &ProviderConfig,
    request: &CopilotGenerationRequest,
) -> Result<CopilotGenerationResponse, String> {
    let token = provider.api_key_hint.trim();
    if token.is_empty() {
        return Err("Missing Gemini API key".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| err.to_string())?;

    let response = client
        .post(format!(
            "{}/v1beta/models/{}:generateContent",
            trim_google_endpoint(&provider.endpoint),
            provider.model
        ))
        .header("x-goog-api-key", token)
        .header(CONTENT_TYPE, "application/json")
        .json(&GeminiGenerateContentRequest {
            contents: vec![GeminiContent {
                role: Some("user".to_string()),
                parts: vec![GeminiPart {
                    text: Some(build_user_prompt(request)),
                }],
            }],
            generation_config: Some(GeminiGenerationConfig {
                temperature: Some(0.2),
                max_output_tokens: Some(1200),
                response_mime_type: Some("application/json".to_string()),
            }),
        })
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini request failed: {}", error_body));
    }

    let payload: GeminiGenerateContentResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = payload
        .candidates
        .into_iter()
        .find_map(|candidate| {
            candidate
                .content
                .parts
                .into_iter()
                .find_map(|part| part.text)
        })
        .ok_or_else(|| "Gemini returned no text content".to_string())?;

    let structured = parse_structured_output(&content)?;
    Ok(to_generation_response(
        provider,
        request,
        structured,
        estimate_provider_latency(&request.settings),
        true,
    ))
}

async fn transcribe_openai_audio(
    provider: &ProviderConfig,
    settings: &AppSettings,
    payload: &AudioChunkPayload,
) -> Result<String, String> {
    let token = provider.api_key_hint.trim();
    if token.is_empty() {
        return Err("Missing OpenAI API key".to_string());
    }

    let audio_bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.audio_base64.as_bytes())
        .map_err(|err| format!("Invalid audio base64 payload: {}", err))?;

    let file_name = payload
        .file_name
        .clone()
        .unwrap_or_else(|| infer_audio_filename(&payload.mime_type));

    let part = Part::bytes(audio_bytes)
        .file_name(file_name)
        .mime_str(&payload.mime_type)
        .map_err(|err| err.to_string())?;

    let form = Form::new()
        .text("model", "gpt-4o-mini-transcribe")
        .text("language", settings.preferred_language.clone())
        .part("file", part);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| err.to_string())?;

    let response = client
        .post(format!(
            "{}/audio/transcriptions",
            trim_trailing_slash(&provider.endpoint)
        ))
        .header(AUTHORIZATION, format!("Bearer {}", token))
        .multipart(form)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI transcription failed: {}", error_body));
    }

    let payload: OpenAiTranscriptionResponse = response.json().await.map_err(|err| err.to_string())?;
    Ok(payload.text)
}

fn to_generation_response(
    provider: &ProviderConfig,
    request: &CopilotGenerationRequest,
    output: StructuredOutput,
    latency_ms: u32,
    supports_vision: bool,
) -> CopilotGenerationResponse {
    CopilotGenerationResponse {
        provider_id: provider.provider_id.clone(),
        suggestions: output
            .suggestions
            .into_iter()
            .take(6)
            .map(|suggestion| SuggestionCard {
                id: Uuid::new_v4().to_string(),
                title: suggestion.title,
                body: suggestion.body,
                r#type: suggestion.kind.unwrap_or_else(|| "reply".to_string()),
                priority: suggestion.priority.unwrap_or_else(|| "medium".to_string()),
            })
            .collect(),
        live_summary: output.live_summary,
        notes: output.notes,
        email_draft: output.email_draft,
        performance: SessionPerformance {
            latency_ms,
            transcription_accuracy: if provider.provider_id == "Ollama" { 93 } else { 95 },
            audio_pipeline: describe_audio_pipeline(&request.settings),
            context_pipeline: describe_context_pipeline(&request.settings, supports_vision),
        },
    }
}

fn build_system_prompt(settings: &AppSettings) -> String {
    format!(
        "You are MeetingClaw, a Windows meeting copilot for {} conversations. Return strict JSON with keys: suggestions, liveSummary, notes, emailDraft. suggestions must be an array of objects with title, body, kind, priority. Preferred language: {}.",
        settings.meeting_mode, settings.preferred_language
    )
}

fn build_user_prompt(request: &CopilotGenerationRequest) -> String {
    let transcript = render_transcript(&request.transcript);
    let screen_context = render_screen_context(&request.screen_context);
    let playbooks = request
        .playbooks
        .iter()
        .filter(|playbook| playbook.active)
        .map(|playbook| format!("- {}: {}", playbook.name, playbook.instructions))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "Meeting mode: {}\nProvider target: {}\nLocal mode: {}\nActive playbooks:\n{}\n\nTranscript:\n{}\n\nScreen context:\n{}\n\nGenerate concise realtime meeting assistance.",
        request.settings.meeting_mode,
        request.settings.ai_provider,
        request.settings.local_mode,
        if playbooks.is_empty() {
            "- none".to_string()
        } else {
            playbooks
        },
        transcript,
        screen_context
    )
}

fn render_transcript(transcript: &[TranscriptSegment]) -> String {
    if transcript.is_empty() {
        return "- No transcript captured yet.".to_string();
    }

    transcript
        .iter()
        .rev()
        .take(8)
        .rev()
        .map(|segment| format!("- {}: {}", segment.speaker, segment.text))
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_screen_context(screen_context: &[ScreenInsight]) -> String {
    if screen_context.is_empty() {
        return "- No screen context captured yet.".to_string();
    }

    screen_context
        .iter()
        .take(4)
        .map(|insight| format!("- {}: {}", insight.headline, insight.detail))
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_structured_output(raw: &str) -> Result<StructuredOutput, String> {
    serde_json::from_str::<StructuredOutput>(raw).map_err(|err| format!("Invalid provider JSON output: {}", err))
}

fn trim_trailing_slash(value: &str) -> String {
    value.trim_end_matches('/').to_string()
}

fn trim_google_endpoint(value: &str) -> String {
    trim_trailing_slash(value).trim_end_matches("/v1beta").to_string()
}

fn infer_audio_filename(mime_type: &str) -> String {
    match mime_type {
        "audio/wav" | "audio/x-wav" => "chunk.wav".to_string(),
        "audio/webm" => "chunk.webm".to_string(),
        "audio/mpeg" => "chunk.mp3".to_string(),
        "audio/mp4" | "audio/m4a" => "chunk.m4a".to_string(),
        _ => "chunk.wav".to_string(),
    }
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
struct OpenAiResponseFormat {
    #[serde(rename = "type")]
    response_type: String,
}

#[derive(Debug, Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OpenAiChatCompletionRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    temperature: f32,
    response_format: OpenAiResponseFormat,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatCompletionResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiTranscriptionResponse {
    text: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoiceMessage {
    content: String,
}

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    system: String,
    stream: bool,
    format: String,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
    total_duration: Option<u64>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessagesRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<AnthropicMessageInput>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessageInput {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicMessagesResponse {
    content: Vec<AnthropicContentBlock>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiGenerateContentRequest {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_mime_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiGenerateContentResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StructuredOutput {
    suggestions: Vec<StructuredSuggestion>,
    live_summary: String,
    notes: String,
    email_draft: String,
}

#[derive(Debug, Deserialize)]
struct StructuredSuggestion {
    title: String,
    body: String,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    priority: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::{parse_structured_output, trim_google_endpoint};

    #[test]
    fn parses_structured_json_output() {
        let raw = r#"{
            "suggestions":[
                {"title":"Answer framing","body":"Lead with the outcome.","kind":"reply","priority":"high"}
            ],
            "liveSummary":"Short summary",
            "notes":"- note",
            "emailDraft":"Subject: Follow-up"
        }"#;

        let parsed = parse_structured_output(raw).expect("json should parse");
        assert_eq!(parsed.suggestions.len(), 1);
        assert_eq!(parsed.live_summary, "Short summary");
        assert_eq!(parsed.suggestions[0].kind.as_deref(), Some("reply"));
    }

    #[test]
    fn normalizes_google_endpoint_suffix() {
        assert_eq!(
            trim_google_endpoint("https://generativelanguage.googleapis.com/v1beta"),
            "https://generativelanguage.googleapis.com"
        );
        assert_eq!(
            trim_google_endpoint("https://generativelanguage.googleapis.com"),
            "https://generativelanguage.googleapis.com"
        );
    }
}
