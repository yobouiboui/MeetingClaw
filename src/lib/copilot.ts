import type { AppSettings, AppSnapshot, Playbook, ScreenInsight, SuggestionCard, TranscriptSegment } from '../types'
import { describeProviderRouting, resolveProviderDescriptor } from './providers'

type CopilotDraft = Pick<
  AppSnapshot['session'],
  'suggestions' | 'liveSummary' | 'notes' | 'emailDraft'
>

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
  return resolveProviderDescriptor(settings).latencyMs
}

export function describeAudioPipeline(settings: AppSettings) {
  return resolveProviderDescriptor(settings).audioPipeline
}

export function describeContextPipeline(settings: AppSettings) {
  return resolveProviderDescriptor(settings).contextPipeline
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
