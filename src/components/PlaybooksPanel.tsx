import { useState } from 'react'
import type { Playbook } from '../types'
import { ShellCard } from './ShellCard'

type PlaybooksPanelProps = {
  playbooks: Playbook[]
  onToggle: (playbookId: string) => void
  onCreate: (playbook: Omit<Playbook, 'id'>) => void
}

export function PlaybooksPanel({ playbooks, onToggle, onCreate }: PlaybooksPanelProps) {
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')

  const activePlaybooks = playbooks.filter((playbook) => playbook.active)
  const promptPreview = activePlaybooks
    .map((playbook) => `- ${playbook.name}: ${playbook.instructions}`)
    .join('\n')

  const createPlaybook = () => {
    const trimmedName = name.trim()
    const trimmedInstructions = instructions.trim()

    if (!trimmedName || !trimmedInstructions) {
      return
    }

    onCreate({
      name: trimmedName,
      summary: summary.trim() || 'Custom user playbook',
      instructions: trimmedInstructions,
      tags: tags
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      active: true,
    })

    setName('')
    setSummary('')
    setInstructions('')
    setTags('')
  }

  return (
    <div className="grid gap-6">
      <ShellCard title="Playbooks" subtitle="Custom instructions that shape live answers, summaries and objection handling.">
        <div className="mb-4 grid gap-3">
          {playbooks.map((playbook) => (
            <article key={playbook.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{playbook.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{playbook.summary}</p>
                </div>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    playbook.active
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-100/8 text-slate-300'
                  }`}
                  onClick={() => onToggle(playbook.id)}
                >
                  {playbook.active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <p className="mb-3 text-sm leading-6 text-slate-300">{playbook.instructions}</p>
              <div className="flex flex-wrap gap-2">
                {playbook.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100/8 px-2 py-1 text-[11px] text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
          <input
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setName(event.target.value)}
            placeholder="Playbook name"
            value={name}
          />
          <input
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Short summary"
            value={summary}
          />
          <textarea
            className="min-h-28 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Detailed instructions injected into the meeting prompt"
            value={instructions}
          />
          <input
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags separated by commas"
            value={tags}
          />
          <button
            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            onClick={createPlaybook}
            type="button"
          >
            Add playbook
          </button>
        </div>
      </ShellCard>

      <ShellCard title="Prompt preview" subtitle="What the realtime AI layer will receive from active playbooks.">
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
          {promptPreview || 'No active playbook. The base system prompt will be used as-is.'}
        </pre>
      </ShellCard>
    </div>
  )
}
