import { useState } from 'react'
import { Activity, Gauge, Layers3, Mic, MonitorSmartphone, Sparkles } from 'lucide-react'
import { composeSystemPrompt } from '../lib/copilot'
import { formatTimestamp } from '../lib/format'
import { useAppStore } from '../store/app-store'
import { HistoryPanel } from './HistoryPanel'
import { NotesPanel } from './NotesPanel'
import { PlaybooksPanel } from './PlaybooksPanel'
import { SessionComposerPanel } from './SessionComposerPanel'
import { SettingsPanel } from './SettingsPanel'
import { ShellCard } from './ShellCard'
import { StatusBadge } from './StatusBadge'
import { SuggestionsPanel } from './SuggestionsPanel'
import { TranscriptPanel } from './TranscriptPanel'

export function MainWindow() {
  const [historyQuery, setHistoryQuery] = useState('')
  const snapshot = useAppStore((state) => state.snapshot)
  const playbooks = useAppStore((state) => state.playbooks)
  const startMeeting = useAppStore((state) => state.startMeeting)
  const stopMeeting = useAppStore((state) => state.stopMeeting)
  const toggleOverlayWindow = useAppStore((state) => state.toggleOverlayWindow)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const addPlaybook = useAppStore((state) => state.addPlaybook)
  const togglePlaybook = useAppStore((state) => state.togglePlaybook)
  const replacePlaybooks = useAppStore((state) => state.replacePlaybooks)
  const injectTranscriptLine = useAppStore((state) => state.injectTranscriptLine)
  const addScreenInsight = useAppStore((state) => state.addScreenInsight)

  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="glass rounded-3xl px-8 py-10 text-center">
          <p className="text-sm text-slate-300">Launching MeetingClaw...</p>
        </div>
      </main>
    )
  }

  const { session, settings, history, diagnostics } = snapshot
  const promptPreview = composeSystemPrompt(settings, playbooks, session.transcript, session.screenContext)

  return (
    <main className="grid-bg min-h-screen px-6 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <header className="glass rounded-[2rem] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                  MeetingClaw
                </span>
                <StatusBadge active={session.active} />
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {diagnostics.runtimeMode}
                </span>
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-white">Windows meeting copilot</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                  MeetingClaw coordinates transcription, screen context, AI suggestions, notes and follow-up drafts
                  in a low-friction desktop flow built for Zoom, Meet, Teams and Webex on Windows.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                onClick={() => void (session.active ? stopMeeting() : startMeeting())}
              >
                {session.active ? 'Stop meeting' : 'Start meeting'}
              </button>
              <button
                className="rounded-2xl border border-slate-700 bg-slate-950/50 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                onClick={() => void toggleOverlayWindow()}
              >
                {session.overlayVisible ? 'Hide overlay' : 'Show overlay'}
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              {
                icon: Mic,
                label: 'Session start',
                value: formatTimestamp(session.startedAt),
              },
              {
                icon: Sparkles,
                label: 'AI provider',
                value: settings.aiProvider,
              },
              {
                icon: Gauge,
                label: 'Latency budget',
                value: `${diagnostics.latencyBudgetMs} ms`,
              },
              {
                icon: Activity,
                label: 'Transcription target',
                value: `${session.performance.transcriptionAccuracy}%`,
              },
              {
                icon: Layers3,
                label: 'Overlay opacity',
                value: `${Math.round(settings.overlayOpacity * 100)}%`,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800/80 bg-slate-950/35 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-400">
                  <item.icon className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">{item.label}</span>
                </div>
                <p className="text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_0.9fr]">
          <TranscriptPanel transcript={session.transcript} />
          <SuggestionsPanel liveSummary={session.liveSummary} suggestions={session.suggestions} />
          <NotesPanel emailDraft={session.emailDraft} notes={session.notes} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <div className="grid gap-6">
            <ShellCard title="Screen context" subtitle="Visual context snapshots queued for OCR and semantic extraction.">
              <div className="grid gap-3">
                {session.screenContext.map((insight) => (
                  <article key={insight.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      <MonitorSmartphone className="h-4 w-4" />
                      {insight.capturedAt}
                    </div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-100">{insight.headline}</h3>
                    <p className="text-sm leading-6 text-slate-300">{insight.detail}</p>
                  </article>
                ))}
              </div>
            </ShellCard>
            <HistoryPanel history={history} onQueryChange={setHistoryQuery} query={historyQuery} />
          </div>
          <SettingsPanel onSave={(next) => void saveSettings(next)} settings={settings} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <PlaybooksPanel
            onCreate={addPlaybook}
            onReplace={replacePlaybooks}
            onToggle={togglePlaybook}
            playbooks={playbooks}
          />
          <div className="grid gap-6">
            <ShellCard
              title="Prompt routing"
              subtitle="Live prompt composition preview from meeting mode, provider and active playbooks."
            >
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Realtime composition</p>
                <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {promptPreview}
                </pre>
              </div>
            </ShellCard>
            <SessionComposerPanel
              onAddScreenInsight={addScreenInsight}
              onAddTranscript={injectTranscriptLine}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
