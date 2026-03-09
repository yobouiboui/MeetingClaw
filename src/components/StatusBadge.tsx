import clsx from 'clsx'

type StatusBadgeProps = {
  active: boolean
}

export function StatusBadge({ active }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
        active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-100/8 text-slate-300',
      )}
    >
      <span
        className={clsx(
          'h-2 w-2 rounded-full',
          active ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.85)]' : 'bg-slate-500',
        )}
      />
      {active ? 'Live session' : 'Standby'}
    </span>
  )
}
