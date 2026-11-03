import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <p className="p-8 text-center text-muted">Chargement…</p>
  }
  return session ? <Outlet /> : <Navigate to="/login" replace />
}
