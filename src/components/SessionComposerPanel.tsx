import { useState } from 'react'
import { ShellCard } from './ShellCard'

type SessionComposerPanelProps = {
  onAddTranscript: (speaker: string, text: string) => void
  onAddScreenInsight: (headline: string, detail: string) => void
  onGeneratePreview: () => void
}

export function SessionComposerPanel({
  onAddTranscript,
  onAddScreenInsight,
  onGeneratePreview,
}: SessionComposerPanelProps) {
  const [speaker, setSpeaker] = useState('You')
  const [transcriptLine, setTranscriptLine] = useState('')
  const [headline, setHeadline] = useState('')
  const [detail, setDetail] = useState('')

  return (
    <ShellCard
      title="Session composer"
      subtitle="Inject transcript lines and screen context manually to drive the copilot in browser demo mode."
    >
      <div className="grid gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Backend contract</p>
          <p className="mb-4 text-sm leading-6 text-slate-300">
            Force a copilot regeneration through the runtime API contract. In browser mode this uses the local adapter;
            in Tauri it will call the backend command.
          </p>
          <button
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
            onClick={onGeneratePreview}
            type="button"
          >
            Generate provider preview
          </button>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manual transcript</p>
          <select
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100"
            onChange={(event) => setSpeaker(event.target.value)}
            value={speaker}
          >
            <option value="You">You</option>
            <option value="Prospect">Prospect</option>
            <option value="Customer">Customer</option>
            <option value="Interviewer">Interviewer</option>
          </select>
          <textarea
            className="min-h-24 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setTranscriptLine(event.target.value)}
            placeholder="Type a new spoken line"
            value={transcriptLine}
          />
          <button
            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            onClick={() => {
              const trimmed = transcriptLine.trim()
              if (!trimmed) {
                return
              }
              onAddTranscript(speaker, trimmed)
              setTranscriptLine('')
            }}
            type="button"
          >
            Add transcript line
          </button>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manual screen context</p>
          <input
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Context headline"
            value={headline}
          />
          <textarea
            className="min-h-24 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Visible slide, objection, KPI or meeting clue"
            value={detail}
          />
          <button
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
            onClick={() => {
              const trimmedHeadline = headline.trim()
              const trimmedDetail = detail.trim()
              if (!trimmedHeadline || !trimmedDetail) {
                return
              }
              onAddScreenInsight(trimmedHeadline, trimmedDetail)
              setHeadline('')
              setDetail('')
            }}
            type="button"
          >
            Add screen context
          </button>
        </div>
      </div>
    </ShellCard>
  )
}
