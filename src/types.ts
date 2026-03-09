export type TranscriptSegment = {
  id: string
  speaker: string
  text: string
  timestamp: string
  confidence: number
}

export type SuggestionCard = {
  id: string
  title: string
  body: string
  type: 'reply' | 'summary' | 'objection' | 'follow-up'
  priority: 'high' | 'medium' | 'low'
}

export type ScreenInsight = {
  id: string
  headline: string
  detail: string
  capturedAt: string
}

export type MeetingRecord = {
  id: string
  title: string
  startedAt: string
  endedAt: string
  summary: string
  followUpEmail: string
  transcriptPreview: string
}

export type Playbook = {
  id: string
  name: string
  summary: string
  instructions: string
  tags: string[]
  active: boolean
}

export type AppSettings = {
  preferredLanguage: string
  aiProvider: string
  localMode: boolean
  overlayOpacity: number
  autoLaunch: boolean
  meetingMode: 'general' | 'sales' | 'interview'
  hotkeys: {
    toggleSession: string
    toggleOverlay: string
    toggleMainWindow: string
  }
}

export type ProviderConnectionStatus = 'configured' | 'missing-auth' | 'offline' | 'unknown'

export type ProviderConfig = {
  providerId: string
  enabled: boolean
  endpoint: string
  model: string
  apiKeyHint: string
  authMode: string
  supportsVision: boolean
  supportsStreaming: boolean
  lastCheckedAt: string | null
  status: ProviderConnectionStatus
}

export type CopilotGenerationRequest = {
  settings: AppSettings
  providers: ProviderConfig[]
  playbooks: Playbook[]
  transcript: TranscriptSegment[]
  screenContext: ScreenInsight[]
}

export type CopilotGenerationResponse = {
  providerId: string
  suggestions: SuggestionCard[]
  liveSummary: string
  notes: string
  emailDraft: string
  performance: SessionPerformance
}

export type SessionPerformance = {
  latencyMs: number
  transcriptionAccuracy: number
  audioPipeline: string
  contextPipeline: string
}

export type SessionState = {
  active: boolean
  sessionId: string | null
  startedAt: string | null
  overlayVisible: boolean
  transcript: TranscriptSegment[]
  suggestions: SuggestionCard[]
  screenContext: ScreenInsight[]
  liveSummary: string
  notes: string
  emailDraft: string
  performance: SessionPerformance
}

export type Diagnostics = {
  runtimeMode: string
  platformTarget: string
  latencyBudgetMs: number
  cpuBudgetActivePercent: number
}

export type AppSnapshot = {
  settings: AppSettings
  providers: ProviderConfig[]
  session: SessionState
  history: MeetingRecord[]
  diagnostics: Diagnostics
}
