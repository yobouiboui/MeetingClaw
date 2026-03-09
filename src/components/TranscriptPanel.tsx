import { formatTimestamp } from '../lib/format'
import type { TranscriptSegment } from '../types'
import { ShellCard } from './ShellCard'

type TranscriptPanelProps = {
  transcript: TranscriptSegment[]
}

export function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  return (
    <ShellCard
      title="Live transcript"
      subtitle="Incremental transcript stream intended to be backed by Whisper or API STT."
      className="h-full"
    >
      <div className="scrollbar-thin flex max-h-[28rem] flex-col gap-3 overflow-auto pr-2">
        {transcript.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/80 p-4 text-sm text-slate-400">
            Start a meeting to begin microphone capture and incremental transcription.
          </div>
        ) : null}
        {transcript.map((segment) => (
          <article key={segment.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>{segment.speaker}</span>
              <span>{formatTimestamp(segment.timestamp)}</span>
            </div>
            <p className="text-sm leading-6 text-slate-100">{segment.text}</p>
          </article>
        ))}
      </div>
    </ShellCard>
  )
}
