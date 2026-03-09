import type { PropsWithChildren, ReactNode } from 'react'
import clsx from 'clsx'

type ShellCardProps = PropsWithChildren<{
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}>

export function ShellCard({ title, subtitle, actions, className, children }: ShellCardProps) {
  return (
    <section className={clsx('glass rounded-3xl p-5 text-slate-100', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
