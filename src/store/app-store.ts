import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { create } from 'zustand'
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
import type { AppSettings, AppSnapshot, Playbook } from '../types'

const PLAYBOOKS_STORAGE_KEY = 'meetingclaw.playbooks'

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
      set({ initialized: true })
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
    const snapshot = await startSession()
    set({ snapshot, error: null })
  },
  stopMeeting: async () => {
    const snapshot = await stopSession()
    set({ snapshot, error: null })
  },
  toggleOverlayWindow: async () => {
    const snapshot = await toggleOverlay()
    set({ snapshot, error: null })
  },
  toggleMain: async () => {
    await toggleMainWindow()
  },
  saveSettings: async (settings) => {
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
    set({ playbooks: nextPlaybooks })
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
    set({ playbooks: nextPlaybooks })
  },
}))
