import { useState } from 'react'
import { formatRelativeDay } from '../lib/format'
import type { MeetingRecord } from '../types'
import { ShellCard } from './ShellCard'

type HistoryPanelProps = {
  history: MeetingRecord[]
  query: string
  onQueryChange: (query: string) => void
}

export function HistoryPanel({ history, query, onQueryChange }: HistoryPanelProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const selectedMeeting = history.find((meeting) => meeting.id === selectedMeetingId) ?? history[0] ?? null

  return (
    <ShellCard title="Meeting history" subtitle="Persistent session archive for recap, replay and future semantic search.">
      <input
        className="mb-4 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search meetings, summaries or transcript snippets"
        value={query}
      />
      <div className="scrollbar-thin flex max-h-[20rem] flex-col gap-3 overflow-auto pr-2">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/80 p-4 text-sm text-slate-400">
            {query.trim() ? 'No result for this query.' : 'No meetings saved yet.'}
          </div>
        ) : null}
        {history.map((meeting) => (
          <article
            key={meeting.id}
            className={`rounded-2xl border p-4 transition ${
              meeting.id === selectedMeeting?.id
                ? 'border-cyan-400/60 bg-cyan-400/10'
                : 'border-slate-800/80 bg-slate-950/45'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-100">{meeting.title}</h3>
              <span className="text-xs text-slate-500">{formatRelativeDay(meeting.startedAt)}</span>
            </div>
            <p className="mb-3 text-sm leading-6 text-slate-300">{meeting.summary}</p>
            <p className="line-clamp-2 text-xs leading-5 text-slate-500">{meeting.transcriptPreview}</p>
            <button
              className="mt-3 rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-500"
              onClick={() => setSelectedMeetingId(meeting.id)}
              type="button"
            >
              {meeting.id === selectedMeeting?.id ? 'Selected' : 'Open detail'}
            </button>
          </article>
        ))}
      </div>
      {selectedMeeting ? (
        <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-100">{selectedMeeting.title}</h3>
            <span className="text-xs text-slate-500">{formatRelativeDay(selectedMeeting.endedAt)}</span>
          </div>
          <p className="mb-3 text-sm leading-6 text-slate-300">{selectedMeeting.summary}</p>
          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Transcript preview</p>
            <p className="text-sm leading-6 text-slate-300">{selectedMeeting.transcriptPreview}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Follow-up email</p>
            <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{selectedMeeting.followUpEmail}</pre>
          </div>
        </div>
      ) : null}
    </ShellCard>
  )
}
