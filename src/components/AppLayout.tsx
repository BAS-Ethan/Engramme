import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Background } from './Background'
import { Logo } from './Logo'

const icon = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const links = [
  { to: '/', label: 'Accueil', end: true, icon: icon('M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z') },
  { to: '/assistant', label: 'Assistant', end: false, icon: icon('M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z') },
  { to: '/calendar', label: 'Calendrier', end: false, icon: icon('M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z') },
  { to: '/projects', label: 'Projets', end: false, icon: icon('M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2M9 13.5l2 2 4-4') },
  { to: '/principles', label: 'Fils directeurs', end: false, icon: icon('M12 2l3 7 7 .8-5.3 4.8 1.6 7.4L12 18l-6.3 4 1.6-7.4L2 9.8 9 9z') },
  { to: '/ideas', label: 'Idées', end: false, icon: icon('M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z') },
]

const actionClass =
  'flex h-12 min-w-0 max-w-12 flex-1 items-center justify-center rounded-2xl transition hover:bg-field active:scale-95 md:w-12 md:flex-none'
const panelClass =
  'absolute bottom-full right-0 mb-3 rounded-card border border-glass-border bg-page/75 p-4 shadow-glass glass-surface md:bottom-0 md:left-full md:right-auto md:mb-0 md:ml-4'

export function AppLayout() {
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  useEffect(() => {
    if (!confirmingLogout) return
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest('[data-popover-area]')) setConfirmingLogout(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmingLogout(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [confirmingLogout])

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Background />

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-2 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-around rounded-card border border-glass-border bg-glass p-1.5 shadow-glass glass-surface sm:inset-x-4 sm:p-2 md:inset-x-auto md:inset-y-4 md:left-4 md:w-16 md:flex-col md:justify-start md:gap-2"
      >
        <Logo small className="mb-2 hidden size-10 shrink-0 self-center md:block" />

        {links.map(({ to, label, end, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            title={label}
            className={({ isActive }) =>
              `${actionClass} ${isActive ? 'bg-accent text-on-accent hover:bg-accent' : 'text-muted'}`
            }
          >
            {icon}
          </NavLink>
        ))}

        <NavLink
          to="/appearance"
          aria-label="Apparence"
          title="Apparence"
          className={({ isActive }) =>
            `${actionClass} md:mt-auto ${isActive ? 'bg-accent text-on-accent hover:bg-accent' : 'text-muted'}`
          }
        >
          {icon('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')}
        </NavLink>

        <div data-popover-area className="min-w-0 max-w-12 flex-1 md:relative md:flex-none">
          <button
            onClick={() => setConfirmingLogout((open) => !open)}
            aria-label="Se déconnecter"
            title="Se déconnecter"
            aria-haspopup="dialog"
            aria-expanded={confirmingLogout}
            className={`${actionClass} w-full ${confirmingLogout ? 'bg-field' : ''} text-danger`}
          >
            {icon('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9')}
          </button>
          {confirmingLogout && (
            <div role="alertdialog" aria-label="Confirmer la déconnexion" className={`${panelClass} w-[min(16rem,calc(100vw-2rem))]`}>
              <p className="font-medium">Se déconnecter ?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  autoFocus
                  onClick={() => setConfirmingLogout(false)}
                  className="min-h-11 rounded-2xl border border-glass-border bg-field px-3 text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void supabase.auth.signOut()}
                  className="min-h-11 rounded-2xl border border-danger-border px-3 text-sm font-medium text-danger"
                >
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="pb-28 md:pb-0 md:pl-24">
        <Outlet />
      </div>
    </div>
  )
}
