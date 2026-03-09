import { describeAudioPipeline, describeContextPipeline, estimateProviderLatency } from '../lib/copilot'
import { describeProviderRouting, resolveProviderDescriptor } from '../lib/providers'
import type { AppSettings } from '../types'
import { ShellCard } from './ShellCard'

type SettingsPanelProps = {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {
  const providerRouting = describeProviderRouting(settings)
  const latencyEstimate = estimateProviderLatency(settings)
  const providerDescriptor = resolveProviderDescriptor(settings)

  return (
    <ShellCard title="Settings" subtitle="Windows-focused defaults for hotkeys, provider routing and local mode.">
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">AI provider</span>
          <select
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100"
            value={settings.aiProvider}
            onChange={(event) =>
              onSave({
                ...settings,
                aiProvider: event.target.value,
              })
            }
          >
            <option value="OpenAI">OpenAI</option>
            <option value="Claude">Claude</option>
            <option value="Gemini">Gemini</option>
            <option value="Ollama">Ollama</option>
          </select>
        </label>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-400">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Resolved provider contract</p>
          <p>Model target: {providerDescriptor.defaultModel}</p>
          <p className="mt-2">Endpoint: {providerDescriptor.endpoint}</p>
          <p className="mt-2">Auth: {providerDescriptor.authMode}</p>
        </div>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Meeting mode</span>
          <select
            className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100"
            value={settings.meetingMode}
            onChange={(event) =>
              onSave({
                ...settings,
                meetingMode: event.target.value as AppSettings['meetingMode'],
              })
            }
          >
            <option value="general">General</option>
            <option value="sales">Sales</option>
            <option value="interview">Interview</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Overlay opacity</span>
          <input
            className="accent-cyan-400"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={settings.overlayOpacity}
            onChange={(event) =>
              onSave({
                ...settings,
                overlayOpacity: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm">
          <span className="text-slate-300">Local-first mode</span>
          <input
            checked={settings.localMode}
            onChange={(event) =>
              onSave({
                ...settings,
                localMode: event.target.checked,
              })
            }
            type="checkbox"
          />
        </label>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-400">
          <p>{settings.hotkeys.toggleSession}: start or stop a meeting</p>
          <p>{settings.hotkeys.toggleOverlay}: show or hide the overlay</p>
          <p>{settings.hotkeys.toggleMainWindow}: restore or hide the main window</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-400">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Provider routing</p>
          <p>{providerRouting}</p>
          <p className="mt-2">Estimated latency: {latencyEstimate} ms</p>
          <p className="mt-2">Audio pipeline: {describeAudioPipeline(settings)}</p>
          <p className="mt-2">Context pipeline: {describeContextPipeline(settings)}</p>
        </div>
      </div>
    </ShellCard>
  )
}
