import { useAppStore } from '../store/app-store'

export function OverlayWindow() {
  const snapshot = useAppStore((state) => state.snapshot)

  if (!snapshot) {
    return null
  }

  const topSuggestions = snapshot.session.suggestions.slice(0, 2)

  return (
    <main
      className="min-h-screen p-4 text-slate-100"
      style={{ opacity: snapshot.settings.overlayOpacity }}
    >
      <div className="glass ml-auto flex h-[calc(100vh-2rem)] w-[28rem] flex-col rounded-[2rem] border border-cyan-400/20 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">MeetingClaw overlay</p>
            <h1 className="text-lg font-semibold text-white">Live cues</h1>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
            {snapshot.session.active ? 'Streaming' : 'Idle'}
          </span>
        </div>
        <div className="mb-4 rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Live summary</p>
          <p className="text-sm leading-6 text-slate-100">{snapshot.session.liveSummary}</p>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-auto pr-1">
          {topSuggestions.map((suggestion) => (
            <article key={suggestion.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h2 className="mb-2 text-sm font-semibold text-white">{suggestion.title}</h2>
              <p className="text-sm leading-6 text-slate-200">{suggestion.body}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
