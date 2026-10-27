import type { ComponentPropsWithoutRef } from 'react'

export function Card({ className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={`rounded-card border border-white/40 bg-white/60 p-5 shadow-glass backdrop-blur-glass dark:border-white/20 dark:bg-white/10 ${className}`}
      {...props}
    />
  )
}
