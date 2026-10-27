import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <p className="p-8 text-center text-slate-500 dark:text-slate-400">Chargement…</p>
  }
  return session ? <Outlet /> : <Navigate to="/login" replace />
}
