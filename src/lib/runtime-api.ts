import {
  fetchSnapshot as fetchTauriSnapshot,
  generateCopilotPreview as generateTauriCopilotPreview,
  ingestScreenInsight as ingestTauriScreenInsight,
  ingestTranscriptSegment as ingestTauriTranscriptSegment,
  isTauriRuntime,
  testProviderConnection as testTauriProviderConnection,
  transcribeAudioChunk as transcribeTauriAudioChunk,
  updateProviderConfig as updateTauriProviderConfig,
} from './tauri'
import {
  buildCopilotDraft,
  describeAudioPipeline,
  describeContextPipeline,
  estimateProviderLatency,
} from './copilot'
import { mergeProviderConfigs, resolveProviderDescriptor, testProviderConfig } from './providers'
import type {
  AppSnapshot,
  AudioChunkPayload,
  CopilotGenerationRequest,
  CopilotGenerationResponse,
  Playbook,
  ProviderConfig,
  ScreenInsightPayload,
  TranscriptIngestPayload,
} from '../types'

export async function fetchRuntimeSnapshot() {
  return fetchTauriSnapshot()
}

export async function updateRuntimeProviderConfig(
  snapshot: AppSnapshot,
  providerId: string,
  patch: Partial<ProviderConfig>,
) {
  if (isTauriRuntime()) {
    return updateTauriProviderConfig(providerId, patch)
  }

  return {
    ...snapshot,
    providers: snapshot.providers.map((provider) =>
      provider.providerId === providerId ? { ...provider, ...patch } : provider,
    ),
  }
}

export async function testRuntimeProviderConnection(snapshot: AppSnapshot, providerId: string) {
  if (isTauriRuntime()) {
    return testTauriProviderConnection(providerId)
  }

  return {
    ...snapshot,
    providers: snapshot.providers.map((provider) =>
      provider.providerId === providerId
        ? {
            ...provider,
            status: testProviderConfig(provider),
            lastCheckedAt: new Date().toISOString(),
          }
        : provider,
    ),
  }
}

export async function generateRuntimeCopilotPreview(
  request: CopilotGenerationRequest,
): Promise<CopilotGenerationResponse> {
  if (isTauriRuntime()) {
    return generateTauriCopilotPreview(request)
  }

  const providers = mergeProviderConfigs(request.settings, request.providers)
  const activeProvider =
    providers.find((provider) => provider.providerId === request.settings.aiProvider) ?? providers[0]
  const descriptor = resolveProviderDescriptor(request.settings)
  const draft = buildCopilotDraft(
    request.settings,
    request.playbooks,
    request.transcript,
    request.screenContext,
  )

  return {
    providerId: activeProvider?.providerId ?? request.settings.aiProvider,
    suggestions: draft.suggestions,
    liveSummary: draft.liveSummary,
    notes: draft.notes,
    emailDraft: draft.emailDraft,
    performance: {
      latencyMs: estimateProviderLatency(request.settings),
      transcriptionAccuracy: activeProvider?.providerId === 'Ollama' ? 93 : 95,
      audioPipeline: describeAudioPipeline(request.settings),
      contextPipeline: descriptor.supportsVision
        ? describeContextPipeline(request.settings)
        : 'Screenshot queue -> OCR adapter -> text-only context ranker',
    },
  }
}

export async function ingestRuntimeTranscript(
  snapshot: AppSnapshot,
  playbooks: Playbook[],
  payload: TranscriptIngestPayload,
) {
  if (isTauriRuntime()) {
    return ingestTauriTranscriptSegment(payload, playbooks)
  }

  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      transcript: [
        ...snapshot.session.transcript,
        {
          id: crypto.randomUUID(),
          speaker: payload.speaker,
          text: payload.text,
          timestamp: new Date().toISOString(),
          confidence: payload.confidence ?? 0.99,
        },
      ],
    },
  }
}

export async function ingestRuntimeScreenInsight(
  snapshot: AppSnapshot,
  playbooks: Playbook[],
  payload: ScreenInsightPayload,
) {
  if (isTauriRuntime()) {
    return ingestTauriScreenInsight(payload, playbooks)
  }

  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      screenContext: [
        {
          id: crypto.randomUUID(),
          headline: payload.headline,
          detail: payload.detail,
          capturedAt: new Date().toLocaleTimeString(),
        },
        ...snapshot.session.screenContext,
      ].slice(0, 8),
    },
  }
}

export async function transcribeRuntimeAudio(
  snapshot: AppSnapshot,
  playbooks: Playbook[],
  payload: AudioChunkPayload,
) {
  if (isTauriRuntime()) {
    return transcribeTauriAudioChunk(payload, playbooks)
  }

  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      transcript: [
        ...snapshot.session.transcript,
        {
          id: crypto.randomUUID(),
          speaker: payload.speakerHint ?? 'You',
          text: '[Browser demo] Audio transcription requires Tauri runtime.',
          timestamp: new Date().toISOString(),
          confidence: 0.5,
        },
      ],
    },
  }
}
