import type { AppSettings } from '../types'

export type ProviderDescriptor = {
  id: string
  style: string
  defaultModel: string
  endpoint: string
  latencyMs: number
  supportsStreaming: boolean
  supportsVision: boolean
  authMode: string
  audioPipeline: string
  contextPipeline: string
}

const providerDescriptors: Record<string, ProviderDescriptor> = {
  OpenAI: {
    id: 'OpenAI',
    style: 'Balanced, fast synthesis',
    defaultModel: 'gpt-4.1-mini',
    endpoint: 'https://api.openai.com/v1',
    latencyMs: 180,
    supportsStreaming: true,
    supportsVision: true,
    authMode: 'Bearer API key',
    audioPipeline: 'Streaming transcript queue via remote low-latency profile',
    contextPipeline: 'Vision summary and OCR routed through remote context pass',
  },
  Claude: {
    id: 'Claude',
    style: 'Reasoned response shaping',
    defaultModel: 'claude-3-7-sonnet',
    endpoint: 'https://api.anthropic.com/v1',
    latencyMs: 240,
    supportsStreaming: true,
    supportsVision: true,
    authMode: 'API key header',
    audioPipeline: 'Streaming transcript queue via remote high-context profile',
    contextPipeline: 'Long-context screen synthesis for discussion state',
  },
  Gemini: {
    id: 'Gemini',
    style: 'Multimodal slide interpretation',
    defaultModel: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com',
    latencyMs: 210,
    supportsStreaming: true,
    supportsVision: true,
    authMode: 'API key query/header',
    audioPipeline: 'Streaming transcript queue via remote multimodal profile',
    contextPipeline: 'Slide-aware screenshot extraction and summarization',
  },
  Ollama: {
    id: 'Ollama',
    style: 'Local-first privacy routing',
    defaultModel: 'llama3.2',
    endpoint: 'http://127.0.0.1:11434',
    latencyMs: 260,
    supportsStreaming: true,
    supportsVision: false,
    authMode: 'No auth on local daemon',
    audioPipeline: 'Local transcript queue for privacy-preserving inference',
    contextPipeline: 'Local screenshot/OCR context synthesis',
  },
}

export function resolveProviderDescriptor(settings: AppSettings) {
  const descriptor = providerDescriptors[settings.aiProvider] ?? providerDescriptors.OpenAI
  if (!settings.localMode) {
    return descriptor
  }

  if (descriptor.id === 'Ollama') {
    return descriptor
  }

  return {
    ...descriptor,
    latencyMs: Math.max(descriptor.latencyMs + 30, 220),
    audioPipeline: `Hybrid local transcript queue with ${descriptor.id} final routing`,
    contextPipeline: `Hybrid local OCR pass with ${descriptor.id} context completion`,
  }
}

export function describeProviderRouting(settings: AppSettings) {
  const descriptor = resolveProviderDescriptor(settings)
  return `${descriptor.id} | ${descriptor.style} | ${settings.localMode ? 'Local-first routing' : 'Cloud routing'}`
}
