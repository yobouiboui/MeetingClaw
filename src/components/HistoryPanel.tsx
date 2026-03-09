import { formatRelativeDay } from '../lib/format'
import type { MeetingRecord } from '../types'
import { ShellCard } from './ShellCard'

type HistoryPanelProps = {
  history: MeetingRecord[]
  query: string
  onQueryChange: (query: string) => void
}

export function HistoryPanel({ history, query, onQueryChange }: HistoryPanelProps) {
  const normalizedQuery = query.trim().toLowerCase()
  const filteredHistory = history.filter((meeting) => {
    if (!normalizedQuery) {
      return true
    }

    return [meeting.title, meeting.summary, meeting.transcriptPreview, meeting.followUpEmail]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })

  return (
    <ShellCard title="Meeting history" subtitle="Persistent session archive for recap, replay and future semantic search.">
      <input
        className="mb-4 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search meetings, summaries or transcript snippets"
        value={query}
      />
      <div className="scrollbar-thin flex max-h-[20rem] flex-col gap-3 overflow-auto pr-2">
        {filteredHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/80 p-4 text-sm text-slate-400">
            {history.length === 0 ? 'No meetings saved yet.' : 'No result for this query.'}
          </div>
        ) : null}
        {filteredHistory.map((meeting) => (
          <article key={meeting.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-100">{meeting.title}</h3>
              <span className="text-xs text-slate-500">{formatRelativeDay(meeting.startedAt)}</span>
            </div>
            <p className="mb-3 text-sm leading-6 text-slate-300">{meeting.summary}</p>
            <p className="line-clamp-2 text-xs leading-5 text-slate-500">{meeting.transcriptPreview}</p>
          </article>
        ))}
      </div>
    </ShellCard>
  )
}
