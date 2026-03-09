import { exportSessionMarkdown } from '../lib/copilot'
import { useAppStore } from '../store/app-store'
import { ShellCard } from './ShellCard'

type NotesPanelProps = {
  notes: string
  emailDraft: string
}

export function NotesPanel({ notes, emailDraft }: NotesPanelProps) {
  const snapshot = useAppStore((state) => state.snapshot)
  const playbooks = useAppStore((state) => state.playbooks)

  const exportCurrentSession = () => {
    if (!snapshot) {
      return
    }

    const blob = new Blob([exportSessionMarkdown(snapshot, playbooks)], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'meetingclaw-session.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-4">
      <ShellCard
        title="Auto notes"
        subtitle="Structured notes captured during the live session."
        actions={
          <button
            className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            onClick={exportCurrentSession}
            type="button"
          >
            Export markdown
          </button>
        }
      >
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{notes}</pre>
      </ShellCard>
      <ShellCard title="Follow-up email" subtitle="Draft generated when the session ends or key milestones are detected.">
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{emailDraft}</pre>
      </ShellCard>
    </div>
  )
}
