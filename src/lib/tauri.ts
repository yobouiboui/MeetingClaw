import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type {
  AppSettings,
  AppSnapshot,
  CopilotGenerationRequest,
  CopilotGenerationResponse,
  Playbook,
  ProviderConfig,
  ScreenInsightPayload,
  TranscriptIngestPayload,
} from '../types'

export const SNAPSHOT_EVENT = 'meetingclaw://snapshot'

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getCurrentWindowLabel() {
  if (!isTauriRuntime()) {
    return 'main'
  }

  return getCurrentWindow().label
}

export async function fetchSnapshot() {
  if (!isTauriRuntime()) {
    return null
  }

  return invoke<AppSnapshot>('get_app_snapshot')
}

export async function startSession() {
  return invoke<AppSnapshot>('start_session')
}

export async function stopSession() {
  return invoke<AppSnapshot>('stop_session')
}

export async function toggleOverlay() {
  return invoke<AppSnapshot>('toggle_overlay')
}

export async function toggleMainWindow() {
  return invoke<void>('toggle_main_window')
}

export async function updateSettings(settings: AppSettings) {
  return invoke<AppSnapshot>('update_settings', { settings })
}

export async function updateProviderConfig(providerId: string, patch: Partial<ProviderConfig>) {
  return invoke<AppSnapshot>('update_provider_config', { providerId, patch })
}

export async function testProviderConnection(providerId: string) {
  return invoke<AppSnapshot>('test_provider_connection', { providerId })
}

export async function generateCopilotPreview(request: CopilotGenerationRequest) {
  return invoke<CopilotGenerationResponse>('generate_copilot_preview', { request })
}

export async function ingestTranscriptSegment(payload: TranscriptIngestPayload, playbooks: Playbook[]) {
  return invoke<AppSnapshot>('ingest_transcript_segment', { payload, playbooks })
}

export async function ingestScreenInsight(payload: ScreenInsightPayload, playbooks: Playbook[]) {
  return invoke<AppSnapshot>('ingest_screen_insight', { payload, playbooks })
}

export async function listenForSnapshots(handler: (snapshot: AppSnapshot) => void) {
  if (!isTauriRuntime()) {
    return () => undefined
  }

  return listen<AppSnapshot>(SNAPSHOT_EVENT, (event) => handler(event.payload))
}
