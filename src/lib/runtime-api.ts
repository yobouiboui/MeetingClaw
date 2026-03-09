import {
  fetchSnapshot as fetchTauriSnapshot,
  generateCopilotPreview as generateTauriCopilotPreview,
  isTauriRuntime,
  testProviderConnection as testTauriProviderConnection,
  updateProviderConfig as updateTauriProviderConfig,
} from './tauri'
import {
  buildCopilotDraft,
  describeAudioPipeline,
  describeContextPipeline,
  estimateProviderLatency,
} from './copilot'
import { mergeProviderConfigs, resolveProviderDescriptor, testProviderConfig } from './providers'
import type { AppSnapshot, CopilotGenerationRequest, CopilotGenerationResponse, ProviderConfig } from '../types'

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
