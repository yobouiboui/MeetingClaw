import type { AppSettings, AppSnapshot, Playbook, ScreenInsight, SuggestionCard, TranscriptSegment } from '../types'

type CopilotDraft = Pick<
  AppSnapshot['session'],
  'suggestions' | 'liveSummary' | 'notes' | 'emailDraft'
>

type ProviderProfile = {
  style: string
  latencyMs: number
  audioPipeline: string
  contextPipeline: string
}

const providerProfiles: Record<string, ProviderProfile> = {
  OpenAI: {
    style: 'Balanced, fast synthesis',
    latencyMs: 180,
    audioPipeline: 'Streaming transcript queue via remote low-latency profile',
    contextPipeline: 'Vision summary and OCR routed through remote context pass',
  },
  Claude: {
    style: 'Reasoned response shaping',
    latencyMs: 240,
    audioPipeline: 'Streaming transcript queue via remote high-context profile',
    contextPipeline: 'Long-context screen synthesis for discussion state',
  },
  Gemini: {
    style: 'Multimodal slide interpretation',
    latencyMs: 210,
    audioPipeline: 'Streaming transcript queue via remote multimodal profile',
    contextPipeline: 'Slide-aware screenshot extraction and summarization',
  },
  Ollama: {
    style: 'Local-first privacy routing',
    latencyMs: 260,
    audioPipeline: 'Local transcript queue for privacy-preserving inference',
    contextPipeline: 'Local screenshot/OCR context synthesis',
  },
}

function getProviderProfile(settings: AppSettings) {
  const profile = providerProfiles[settings.aiProvider] ?? providerProfiles.OpenAI
  if (!settings.localMode) {
    return profile
  }

  return {
    ...profile,
    latencyMs: Math.max(profile.latencyMs + 30, 220),
    audioPipeline: settings.aiProvider === 'Ollama'
      ? profile.audioPipeline
      : `Hybrid local transcript queue with ${settings.aiProvider} final routing`,
    contextPipeline: settings.aiProvider === 'Ollama'
      ? profile.contextPipeline
      : `Hybrid local OCR pass with ${settings.aiProvider} context completion`,
  }
}

function latestTranscriptLine(transcript: TranscriptSegment[]) {
  return transcript.at(-1)?.text ?? 'No transcript captured yet.'
}

function activePlaybookText(playbooks: Playbook[]) {
  const active = playbooks.filter((playbook) => playbook.active)
  if (active.length === 0) {
    return 'No active playbook. Use the base assistant behavior.'
  }

  return active
    .map((playbook) => `${playbook.name}: ${playbook.instructions}`)
    .join(' ')
}

function latestScreenInsight(screenContext: ScreenInsight[]) {
  return screenContext[0]?.detail ?? 'No screen context captured yet.'
}

export function estimateProviderLatency(settings: AppSettings) {
  return getProviderProfile(settings).latencyMs
}

export function describeProviderRouting(settings: AppSettings) {
  const profile = getProviderProfile(settings)
  return `${settings.aiProvider} | ${profile.style} | ${settings.localMode ? 'Local-first routing' : 'Cloud routing'}`
}

export function describeAudioPipeline(settings: AppSettings) {
  return getProviderProfile(settings).audioPipeline
}

export function describeContextPipeline(settings: AppSettings) {
  return getProviderProfile(settings).contextPipeline
}

export function buildCopilotDraft(
  settings: AppSettings,
  playbooks: Playbook[],
  transcript: TranscriptSegment[],
  screenContext: ScreenInsight[],
): CopilotDraft {
  const latestLine = latestTranscriptLine(transcript)
  const playbookGuide = activePlaybookText(playbooks)
  const screenGuide = latestScreenInsight(screenContext)
  const providerRouting = describeProviderRouting(settings)

  const suggestions: SuggestionCard[] = [
    {
      id: crypto.randomUUID(),
      title: `${settings.aiProvider} answer framing`,
      body: `Lead with the outcome, reference "${latestLine}", then anchor the response with: ${playbookGuide}`,
      type: 'reply',
      priority: 'high',
    },
    {
      id: crypto.randomUUID(),
      title: 'Context cue',
      body: `Visible context suggests: ${screenGuide}. Route the answer using ${providerRouting}.`,
      type: 'summary',
      priority: 'medium',
    },
    {
      id: crypto.randomUUID(),
      title: 'Follow-up move',
      body: `Close with a clear owner, timeline and next step aligned to ${settings.meetingMode} mode and ${settings.localMode ? 'privacy-preserving' : 'cloud-assisted'} routing.`,
      type: 'follow-up',
      priority: 'medium',
    },
  ]

  const liveSummary = [
    `Mode: ${settings.meetingMode}.`,
    `Latest transcript: ${latestLine}`,
    `Provider route: ${providerRouting}.`,
    `Prompt steering: ${playbookGuide}`,
  ].join(' ')

  const notes = [
    '- Current meeting signal',
    `  ${latestLine}`,
    '- Screen cue',
    `  ${screenGuide}`,
    '- Provider route',
    `  ${providerRouting}`,
    '- Active playbooks',
    `  ${playbooks.filter((playbook) => playbook.active).map((playbook) => playbook.name).join(', ') || 'None'}`,
  ].join('\n')

  const emailDraft = [
    'Subject: Follow-up from today',
    '',
    'Hi team,',
    '',
    `Here is the current recap from the ${settings.meetingMode} conversation:`,
    `- latest topic: ${latestLine}`,
    `- visible context: ${screenGuide}`,
    `- provider route: ${providerRouting}`,
    '- next step: confirm owner, timeline and checkpoint',
    '',
    'Best,',
  ].join('\n')

  return {
    suggestions,
    liveSummary,
    notes,
    emailDraft,
  }
}

export function composeSystemPrompt(
  settings: AppSettings,
  playbooks: Playbook[],
  transcript: TranscriptSegment[],
  screenContext: ScreenInsight[],
) {
  return [
    `You are MeetingClaw, a Windows meeting copilot for ${settings.meetingMode} conversations.`,
    `Preferred language: ${settings.preferredLanguage}.`,
    `AI provider target: ${settings.aiProvider}.`,
    `Provider routing: ${describeProviderRouting(settings)}.`,
    `Latest transcript: ${latestTranscriptLine(transcript)}`,
    `Latest screen context: ${latestScreenInsight(screenContext)}`,
    'Active playbooks:',
    ...playbooks
      .filter((playbook) => playbook.active)
      .map((playbook) => `- ${playbook.name}: ${playbook.instructions}`),
  ].join('\n')
}

export function exportSessionMarkdown(snapshot: AppSnapshot, playbooks: Playbook[]) {
  return [
    '# MeetingClaw Session Export',
    '',
    `- Session active: ${snapshot.session.active ? 'yes' : 'no'}`,
    `- Started at: ${snapshot.session.startedAt ?? 'n/a'}`,
    `- Provider: ${snapshot.settings.aiProvider}`,
    `- Mode: ${snapshot.settings.meetingMode}`,
    '',
    '## Live summary',
    snapshot.session.liveSummary,
    '',
    '## Active playbooks',
    ...playbooks
      .filter((playbook) => playbook.active)
      .map((playbook) => `- ${playbook.name}: ${playbook.summary}`),
    '',
    '## Transcript',
    ...snapshot.session.transcript.map(
      (segment) => `- [${segment.timestamp}] ${segment.speaker}: ${segment.text}`,
    ),
    '',
    '## Suggestions',
    ...snapshot.session.suggestions.map(
      (suggestion) => `- ${suggestion.title} (${suggestion.type}/${suggestion.priority}): ${suggestion.body}`,
    ),
    '',
    '## Notes',
    snapshot.session.notes,
    '',
    '## Follow-up email',
    snapshot.session.emailDraft,
  ].join('\n')
}
