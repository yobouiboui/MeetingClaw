import { ShellCard } from './ShellCard'

type NotesPanelProps = {
  notes: string
  emailDraft: string
}

export function NotesPanel({ notes, emailDraft }: NotesPanelProps) {
  return (
    <div className="grid gap-4">
      <ShellCard title="Auto notes" subtitle="Structured notes captured during the live session.">
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{notes}</pre>
      </ShellCard>
      <ShellCard title="Follow-up email" subtitle="Draft generated when the session ends or key milestones are detected.">
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{emailDraft}</pre>
      </ShellCard>
    </div>
  )
}
