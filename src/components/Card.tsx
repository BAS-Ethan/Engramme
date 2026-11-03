import type { ComponentPropsWithoutRef } from 'react'

export function Card({ className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={`rounded-card border border-glass-border bg-glass p-5 shadow-glass glass-surface ${className}`}
      {...props}
    />
  )
}
