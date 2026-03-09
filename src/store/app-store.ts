import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { create } from 'zustand'
import {
  buildCopilotDraft,
  describeAudioPipeline,
  describeContextPipeline,
  estimateProviderLatency,
} from '../lib/copilot'
import { createDemoSnapshot, demoTranscriptQueue } from '../lib/demo-data'
import {
  fetchSnapshot,
  isTauriRuntime,
  listenForSnapshots,
  startSession,
  stopSession,
  toggleMainWindow,
  toggleOverlay,
  updateSettings,
} from '../lib/tauri'
import type { AppSettings, AppSnapshot, Playbook, TranscriptSegment } from '../types'

const PLAYBOOKS_STORAGE_KEY = 'meetingclaw.playbooks'
const BROWSER_SNAPSHOT_STORAGE_KEY = 'meetingclaw.browserSnapshot'

const defaultPlaybooks: Playbook[] = [
  {
    id: 'sales-objections',
    name: 'Sales objections',
    summary: 'Keeps answers anchored on business impact, risk control and next steps.',
    instructions:
      'When objections appear, acknowledge the risk first, answer with one measurable mitigation, then propose the lowest-friction next step.',
    tags: ['sales', 'objections', 'next-step'],
    active: true,
  },
  {
    id: 'executive-briefing',
    name: 'Executive briefing',
    summary: 'Compresses answers for senior stakeholders.',
    instructions:
      'Respond in three sentences max. Prioritize outcome, timeline and owner. Avoid implementation detail unless explicitly requested.',
    tags: ['exec', 'concise', 'leadership'],
    active: true,
  },
]

function loadPlaybooks() {
  if (typeof window === 'undefined') {
    return defaultPlaybooks
  }

  const raw = window.localStorage.getItem(PLAYBOOKS_STORAGE_KEY)
  if (!raw) {
    return defaultPlaybooks
  }

  try {
    const parsed = JSON.parse(raw) as Playbook[]
    return parsed.length > 0 ? parsed : defaultPlaybooks
  } catch {
    return defaultPlaybooks
  }
}

function persistPlaybooks(playbooks: Playbook[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PLAYBOOKS_STORAGE_KEY, JSON.stringify(playbooks))
}

function loadBrowserSnapshot(playbooks: Playbook[]) {
  if (typeof window === 'undefined') {
    return createDemoSnapshot(playbooks)
  }

  const raw = window.localStorage.getItem(BROWSER_SNAPSHOT_STORAGE_KEY)
  if (!raw) {
    return createDemoSnapshot(playbooks)
  }

  try {
    return JSON.parse(raw) as AppSnapshot
  } catch {
    return createDemoSnapshot(playbooks)
  }
}

function persistBrowserSnapshot(snapshot: AppSnapshot | null) {
  if (typeof window === 'undefined' || snapshot == null) {
    return
  }

  window.localStorage.setItem(BROWSER_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
}

let demoInterval: number | null = null

function ensureDemoSessionLoop(get: () => AppStore, set: (partial: Partial<AppStore>) => void) {
  if (demoInterval !== null) {
    window.clearInterval(demoInterval)
  }

  let queueIndex = 0

  demoInterval = window.setInterval(() => {
    const snapshot = get().snapshot
    if (!snapshot?.session.active) {
      return
    }

    const nextLine = demoTranscriptQueue[queueIndex % demoTranscriptQueue.length]
    queueIndex += 1

    const nextTranscript: TranscriptSegment[] = [
      ...snapshot.session.transcript,
      {
        id: crypto.randomUUID(),
        speaker: queueIndex % 2 === 0 ? 'You' : 'Prospect',
        text: nextLine,
        timestamp: new Date().toISOString(),
        confidence: 0.97,
      },
    ]

    const nextScreenContext = [
      {
        id: crypto.randomUUID(),
        headline: `Context pass ${queueIndex}`,
        detail: `Detected meeting signal around: ${nextLine}`,
        capturedAt: new Date().toLocaleTimeString(),
      },
      ...snapshot.session.screenContext,
    ].slice(0, 4)

    const nextSnapshot = {
      ...snapshot,
      session: applyDraftToSession(snapshot, get().playbooks, {
        transcript: nextTranscript,
        screenContext: nextScreenContext,
      }),
    }

    persistBrowserSnapshot(nextSnapshot)
    set({ snapshot: nextSnapshot })
  }, 3200)
}

function stopDemoSessionLoop() {
  if (demoInterval !== null) {
    window.clearInterval(demoInterval)
    demoInterval = null
  }
}

function applyDraftToSession(
  snapshot: AppSnapshot,
  playbooks: Playbook[],
  sessionPatch: Partial<AppSnapshot['session']> = {},
) {
  const nextTranscript = sessionPatch.transcript ?? snapshot.session.transcript
  const nextScreenContext = sessionPatch.screenContext ?? snapshot.session.screenContext
  const nextSettings = snapshot.settings
  const draft = buildCopilotDraft(nextSettings, playbooks, nextTranscript, nextScreenContext)

  return {
    ...snapshot.session,
    ...sessionPatch,
    suggestions: draft.suggestions,
    liveSummary: draft.liveSummary,
    notes: draft.notes,
    emailDraft: draft.emailDraft,
    performance: {
      ...snapshot.session.performance,
      latencyMs: estimateProviderLatency(nextSettings),
      audioPipeline: describeAudioPipeline(nextSettings),
      contextPipeline: describeContextPipeline(nextSettings),
    },
  }
}

type AppStore = {
  snapshot: AppSnapshot | null
  playbooks: Playbook[]
  initialized: boolean
  error: string | null
  initialize: () => Promise<void>
  startMeeting: () => Promise<void>
  stopMeeting: () => Promise<void>
  toggleOverlayWindow: () => Promise<void>
  toggleMain: () => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<void>
  addPlaybook: (playbook: Omit<Playbook, 'id'>) => void
  togglePlaybook: (playbookId: string) => void
  replacePlaybooks: (playbooks: Playbook[]) => void
  injectTranscriptLine: (speaker: string, text: string) => void
  addScreenInsight: (headline: string, detail: string) => void
}

async function registerShortcuts(snapshot: AppSnapshot, store: AppStore) {
  if (!isTauriRuntime()) {
    return
  }

  await unregisterAll()
  await register(
    [
      snapshot.settings.hotkeys.toggleSession,
      snapshot.settings.hotkeys.toggleOverlay,
      snapshot.settings.hotkeys.toggleMainWindow,
    ],
    async (event) => {
      if (event.state !== 'Pressed') {
        return false
      }

      if (event.shortcut === snapshot.settings.hotkeys.toggleSession) {
        if (store.snapshot?.session.active) {
          await store.stopMeeting()
        } else {
          await store.startMeeting()
        }
      }

      if (event.shortcut === snapshot.settings.hotkeys.toggleOverlay) {
        await store.toggleOverlayWindow()
      }

      if (event.shortcut === snapshot.settings.hotkeys.toggleMainWindow) {
        await store.toggleMain()
      }

      return true
    },
  )
}

export const useAppStore = create<AppStore>((set, get) => ({
  snapshot: null,
  playbooks: loadPlaybooks(),
  initialized: false,
  error: null,
  initialize: async () => {
    if (get().initialized) {
      return
    }

    if (!isTauriRuntime()) {
      const snapshot = loadBrowserSnapshot(get().playbooks)
      set({
        initialized: true,
        snapshot,
      })
      return
    }

    const snapshot = await fetchSnapshot()
    if (snapshot) {
      set({ snapshot, initialized: true, error: null })
      await registerShortcuts(snapshot, get())
    }

    const unlisten = await listenForSnapshots(async (nextSnapshot) => {
      set({ snapshot: nextSnapshot, error: null })
      await registerShortcuts(nextSnapshot, get())
    })

    window.addEventListener(
      'beforeunload',
      () => {
        void unregisterAll()
        unlisten()
      },
      { once: true },
    )
  },
  startMeeting: async () => {
    if (!isTauriRuntime()) {
      const snapshot = get().snapshot ?? createDemoSnapshot(get().playbooks)
      const nextSnapshot = {
        ...snapshot,
        session: applyDraftToSession(snapshot, get().playbooks, {
          active: true,
          sessionId: crypto.randomUUID(),
          startedAt: new Date().toISOString(),
        }),
      }
      set({
        snapshot: nextSnapshot,
        error: null,
      })
      persistBrowserSnapshot(nextSnapshot)
      ensureDemoSessionLoop(get, set)
      return
    }

    const snapshot = await startSession()
    set({ snapshot, error: null })
  },
  stopMeeting: async () => {
    if (!isTauriRuntime()) {
      stopDemoSessionLoop()
      const snapshot = get().snapshot
      if (!snapshot) {
        return
      }

      const nextSnapshot = {
        ...snapshot,
        history: [
          {
            id: snapshot.session.sessionId ?? crypto.randomUUID(),
            title: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            startedAt: snapshot.session.startedAt ?? new Date().toISOString(),
            endedAt: new Date().toISOString(),
            summary: snapshot.session.liveSummary,
            followUpEmail: snapshot.session.emailDraft,
            transcriptPreview: snapshot.session.transcript.map((segment) => segment.text).slice(-3).join(' '),
          },
          ...snapshot.history,
        ].slice(0, 12),
        session: {
          ...snapshot.session,
          active: false,
          performance: {
            ...snapshot.session.performance,
            latencyMs: estimateProviderLatency(snapshot.settings),
            audioPipeline: describeAudioPipeline(snapshot.settings),
            contextPipeline: describeContextPipeline(snapshot.settings),
          },
        },
      }
      persistBrowserSnapshot(nextSnapshot)
      set({
        snapshot: nextSnapshot,
        error: null,
      })
      return
    }

    const snapshot = await stopSession()
    set({ snapshot, error: null })
  },
  toggleOverlayWindow: async () => {
    if (!isTauriRuntime()) {
      const snapshot = get().snapshot
      if (!snapshot) {
        return
      }

      const nextSnapshot = {
        ...snapshot,
        session: {
          ...snapshot.session,
          overlayVisible: !snapshot.session.overlayVisible,
        },
      }
      persistBrowserSnapshot(nextSnapshot)
      set({
        snapshot: nextSnapshot,
        error: null,
      })
      return
    }

    const snapshot = await toggleOverlay()
    set({ snapshot, error: null })
  },
  toggleMain: async () => {
    if (!isTauriRuntime()) {
      return
    }

    await toggleMainWindow()
  },
  saveSettings: async (settings) => {
    if (!isTauriRuntime()) {
      const snapshot = get().snapshot
      if (!snapshot) {
        return
      }

      const nextSnapshot = {
        ...snapshot,
        settings,
        session: applyDraftToSession({ ...snapshot, settings }, get().playbooks),
      }
      persistBrowserSnapshot(nextSnapshot)
      set({
        snapshot: nextSnapshot,
        error: null,
      })
      return
    }

    const snapshot = await updateSettings(settings)
    set({ snapshot, error: null })
  },
  addPlaybook: (playbook) => {
    const nextPlaybooks = [
      {
        id: `playbook-${crypto.randomUUID()}`,
        ...playbook,
      },
      ...get().playbooks,
    ]
    persistPlaybooks(nextPlaybooks)
    const snapshot = get().snapshot
    const nextSnapshot =
      snapshot == null
        ? snapshot
        : {
            ...snapshot,
            session: applyDraftToSession(snapshot, nextPlaybooks),
          }
    persistBrowserSnapshot(nextSnapshot)
    set({ playbooks: nextPlaybooks, snapshot: nextSnapshot })
  },
  togglePlaybook: (playbookId) => {
    const nextPlaybooks = get().playbooks.map((playbook) =>
      playbook.id === playbookId
        ? {
            ...playbook,
            active: !playbook.active,
          }
        : playbook,
    )
    persistPlaybooks(nextPlaybooks)
    const snapshot = get().snapshot
    const nextSnapshot =
      snapshot == null
        ? snapshot
        : {
            ...snapshot,
            session: applyDraftToSession(snapshot, nextPlaybooks),
          }
    persistBrowserSnapshot(nextSnapshot)
    set({ playbooks: nextPlaybooks, snapshot: nextSnapshot })
  },
  replacePlaybooks: (playbooks) => {
    persistPlaybooks(playbooks)
    const snapshot = get().snapshot
    const nextSnapshot =
      snapshot == null
        ? snapshot
        : {
            ...snapshot,
            session: applyDraftToSession(snapshot, playbooks),
          }
    persistBrowserSnapshot(nextSnapshot)
    set({ playbooks, snapshot: nextSnapshot })
  },
  injectTranscriptLine: (speaker, text) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const nextTranscript = [
      ...snapshot.session.transcript,
      {
        id: crypto.randomUUID(),
        speaker,
        text,
        timestamp: new Date().toISOString(),
        confidence: 0.99,
      },
    ]

    const nextSnapshot = {
      ...snapshot,
      session: applyDraftToSession(snapshot, get().playbooks, {
        transcript: nextTranscript,
      }),
    }
    persistBrowserSnapshot(nextSnapshot)
    set({ snapshot: nextSnapshot })
  },
  addScreenInsight: (headline, detail) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const nextScreenContext = [
      {
        id: crypto.randomUUID(),
        headline,
        detail,
        capturedAt: new Date().toLocaleTimeString(),
      },
      ...snapshot.session.screenContext,
    ].slice(0, 4)

    const nextSnapshot = {
      ...snapshot,
      session: applyDraftToSession(snapshot, get().playbooks, {
        screenContext: nextScreenContext,
      }),
    }
    persistBrowserSnapshot(nextSnapshot)
    set({ snapshot: nextSnapshot })
  },
}))
