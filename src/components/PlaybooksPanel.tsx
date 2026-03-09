import { useRef, useState } from 'react'
import type { Playbook } from '../types'
import { ShellCard } from './ShellCard'

type PlaybooksPanelProps = {
  playbooks: Playbook[]
  onToggle: (playbookId: string) => void
  onCreate: (playbook: Omit<Playbook, 'id'>) => void
  onReplace: (playbooks: Playbook[]) => void
}

export function PlaybooksPanel({ playbooks, onToggle, onCreate, onReplace }: PlaybooksPanelProps) {
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const exportPlaybooks = () => {
    const blob = new Blob([JSON.stringify(playbooks, null, 2)], {
      type: 'application/json',
    })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `meetingclaw-playbooks-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(href)
  }

  const importPlaybooks = async (file: File | null) => {
    if (!file) {
      return
    }

    const raw = await file.text()

    try {
      const parsed = JSON.parse(raw) as Playbook[]
      const sanitized = parsed
        .filter((playbook) => playbook.name?.trim() && playbook.instructions?.trim())
        .map((playbook) => ({
          id: playbook.id?.trim() || `playbook-${crypto.randomUUID()}`,
          name: playbook.name.trim(),
          summary: playbook.summary?.trim() || 'Imported playbook',
          instructions: playbook.instructions.trim(),
          tags: Array.isArray(playbook.tags) ? playbook.tags.filter(Boolean) : [],
          active: playbook.active ?? true,
        }))

      if (sanitized.length > 0) {
        onReplace(sanitized)
      }
    } catch {
      return
    } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
    }
  }

  return (
    <div className="grid gap-6">
      <ShellCard title="Playbooks" subtitle="Custom instructions that shape live answers, summaries and objection handling.">
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            onClick={exportPlaybooks}
            type="button"
          >
            Export JSON
          </button>
          <button
            className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Import JSON
          </button>
          <input
            accept="application/json"
            className="hidden"
            onChange={(event) => void importPlaybooks(event.target.files?.[0] ?? null)}
            ref={fileInputRef}
            type="file"
          />
        </div>
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
