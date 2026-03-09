import { formatTimestamp } from '../lib/format'
import type { ProviderConfig } from '../types'
import { ShellCard } from './ShellCard'

type ProvidersPanelProps = {
  providers: ProviderConfig[]
  activeProviderId: string
  onUpdate: (providerId: string, patch: Partial<ProviderConfig>) => void
  onTest: (providerId: string) => void
}

const statusTone: Record<ProviderConfig['status'], string> = {
  configured: 'bg-emerald-500/15 text-emerald-300',
  'missing-auth': 'bg-amber-500/15 text-amber-300',
  offline: 'bg-rose-500/15 text-rose-300',
  unknown: 'bg-slate-100/8 text-slate-300',
}

export function ProvidersPanel({ providers, activeProviderId, onUpdate, onTest }: ProvidersPanelProps) {
  return (
    <ShellCard title="Provider connections" subtitle="Prepare real API wiring for Windows-native routing and fallback selection.">
      <div className="grid gap-4">
        {providers.map((provider) => (
          <article key={provider.providerId} className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{provider.providerId}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {provider.supportsStreaming ? 'Streaming' : 'No streaming'} •{' '}
                  {provider.supportsVision ? 'Vision' : 'Text/OCR only'} • {provider.authMode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {provider.providerId === activeProviderId ? (
                  <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Active route
                  </span>
                ) : null}
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone[provider.status]}`}>
                  {provider.status}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="text-slate-300">Endpoint</span>
                <input
                  className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100"
                  onChange={(event) => onUpdate(provider.providerId, { endpoint: event.target.value })}
                  value={provider.endpoint}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-slate-300">Model</span>
                <input
                  className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100"
                  onChange={(event) => onUpdate(provider.providerId, { model: event.target.value })}
                  value={provider.model}
                />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="text-slate-300">API key or hint</span>
                <input
                  className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100"
                  onChange={(event) => onUpdate(provider.providerId, { apiKeyHint: event.target.value })}
                  placeholder={provider.providerId === 'Ollama' ? 'No key needed for local daemon' : 'Paste or describe the configured secret'}
                  value={provider.apiKeyHint}
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  checked={provider.enabled}
                  onChange={(event) => onUpdate(provider.providerId, { enabled: event.target.checked })}
                  type="checkbox"
                />
                Enabled
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Last checked: {formatTimestamp(provider.lastCheckedAt)}
                </span>
                <button
                  className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                  onClick={() => onTest(provider.providerId)}
                  type="button"
                >
                  Test connection
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </ShellCard>
  )
}
