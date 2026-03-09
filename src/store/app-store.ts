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
import type { AppSettings, AppSnapshot } from '../types'

type AppStore = {
  snapshot: AppSnapshot | null
  initialized: boolean
  error: string | null
  initialize: () => Promise<void>
  startMeeting: () => Promise<void>
  stopMeeting: () => Promise<void>
  toggleOverlayWindow: () => Promise<void>
  toggleMain: () => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<void>
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
}))
