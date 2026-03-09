import { buildCopilotDraft, describeAudioPipeline, describeContextPipeline, estimateProviderLatency } from './copilot'
import type { AppSnapshot, AppSettings, Playbook, ScreenInsight, TranscriptSegment } from '../types'

const defaultSettings: AppSettings = {
  preferredLanguage: 'fr',
  aiProvider: 'OpenAI',
  localMode: true,
  overlayOpacity: 0.88,
  autoLaunch: false,
  meetingMode: 'sales',
  hotkeys: {
    toggleSession: 'CommandOrControl+Shift+Enter',
    toggleOverlay: 'CommandOrControl+Shift+O',
    toggleMainWindow: 'CommandOrControl+Shift+M',
  },
}

const defaultTranscript: TranscriptSegment[] = [
  {
    id: crypto.randomUUID(),
    speaker: 'Prospect',
    text: 'We need a rollout plan that does not create extra admin work for the team.',
    timestamp: new Date().toISOString(),
    confidence: 0.98,
  },
]

const defaultScreenContext: ScreenInsight[] = [
  {
    id: crypto.randomUUID(),
    headline: 'Sales deck visible',
    detail: 'Current slide emphasizes onboarding time, team rollout and measurable adoption.',
    capturedAt: new Date().toLocaleTimeString(),
  },
]

export const demoTranscriptQueue = [
  'We are mostly worried about changing the process too quickly.',
  'A phased pilot with one team would be easier for us to approve.',
  'Can you summarize what success should look like after the first two weeks?',
  'We also want a follow-up email with owners and dates.',
]

export function createDemoSnapshot(playbooks: Playbook[]): AppSnapshot {
  const draft = buildCopilotDraft(defaultSettings, playbooks, defaultTranscript, defaultScreenContext)

  return {
    settings: defaultSettings,
    session: {
      active: false,
      sessionId: null,
      startedAt: null,
      overlayVisible: false,
      transcript: defaultTranscript,
      suggestions: draft.suggestions,
      screenContext: defaultScreenContext,
      liveSummary: draft.liveSummary,
      notes: draft.notes,
      emailDraft: draft.emailDraft,
      performance: {
        latencyMs: estimateProviderLatency(defaultSettings),
        transcriptionAccuracy: 95,
        audioPipeline: describeAudioPipeline(defaultSettings),
        contextPipeline: describeContextPipeline(defaultSettings),
      },
    },
    history: [
      {
        id: crypto.randomUUID(),
        title: 'Executive sync demo',
        startedAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
        endedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        summary: 'Discussed phased rollout, owners and KPI framing for leadership.',
        followUpEmail: 'Shared recap with next step and timeline.',
        transcriptPreview: 'Discussed rollout control, onboarding time and decision owner.',
      },
    ],
    diagnostics: {
      runtimeMode: 'Browser demo mode',
      platformTarget: 'web-preview',
      latencyBudgetMs: 300,
      cpuBudgetActivePercent: 30,
    },
  }
}
