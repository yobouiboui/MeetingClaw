import { describeAudioPipeline, describeContextPipeline, estimateProviderLatency } from '../lib/copilot'
import { describeProviderRouting, resolveProviderDescriptor } from '../lib/providers'
import type { AppSettings, Diagnostics, SessionPerformance } from '../types'
import { ShellCard } from './ShellCard'

type DiagnosticsPanelProps = {
  diagnostics: Diagnostics
  performance: SessionPerformance
  settings: AppSettings
}

export function DiagnosticsPanel({ diagnostics, performance, settings }: DiagnosticsPanelProps) {
  const provider = resolveProviderDescriptor(settings)
  const providerRouting = describeProviderRouting(settings)

  const checks = [
    {
      label: 'Streaming support',
      value: provider.supportsStreaming ? 'Ready' : 'Missing',
    },
    {
      label: 'Vision support',
      value: provider.supportsVision ? 'Ready' : 'Fallback OCR only',
    },
    {
      label: 'Latency target',
      value: `${estimateProviderLatency(settings)} / ${diagnostics.latencyBudgetMs} ms`,
    },
    {
      label: 'CPU budget',
      value: `${diagnostics.cpuBudgetActivePercent}% active`,
    },
  ]

  return (
    <ShellCard title="Diagnostics" subtitle="Resolved runtime contract for the future Windows-native provider pipeline.">
      <div className="grid gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Runtime route</p>
          <p className="text-sm leading-6 text-slate-200">{providerRouting}</p>
          <p className="mt-3 text-xs text-slate-400">Platform target: {diagnostics.platformTarget}</p>
          <p className="mt-1 text-xs text-slate-400">Runtime mode: {diagnostics.runtimeMode}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <div key={check.label} className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{check.label}</p>
              <p className="mt-2 text-sm font-medium text-slate-100">{check.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Pipelines</p>
          <p className="text-sm leading-6 text-slate-300">Audio: {describeAudioPipeline(settings)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Context: {describeContextPipeline(settings)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Session performance: {performance.latencyMs} ms live latency, {performance.transcriptionAccuracy}% transcript target.
          </p>
        </div>
      </div>
    </ShellCard>
  )
}
