import clsx from 'clsx'
import type { SuggestionCard } from '../types'
import { ShellCard } from './ShellCard'

type SuggestionsPanelProps = {
  suggestions: SuggestionCard[]
  liveSummary: string
}

const tone = {
  high: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  medium: 'border-sky-400/40 bg-sky-400/10 text-sky-100',
  low: 'border-slate-400/30 bg-slate-300/10 text-slate-100',
}

export function SuggestionsPanel({ suggestions, liveSummary }: SuggestionsPanelProps) {
  return (
    <ShellCard title="AI copilot" subtitle="Replies, objection handling and slide explanations streamed into the overlay.">
      <div className="mb-4 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Live summary</p>
        <p className="text-sm leading-6 text-slate-100">{liveSummary}</p>
      </div>
      <div className="grid gap-3">
        {suggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className={clsx(
              'rounded-2xl border p-4 transition duration-300',
              tone[suggestion.priority],
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{suggestion.title}</h3>
              <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em]">
                {suggestion.type}
              </span>
            </div>
            <p className="text-sm leading-6">{suggestion.body}</p>
          </article>
        ))}
      </div>
    </ShellCard>
  )
}
