import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole: UserRole
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== requiredRole) {
    return <Navigate to={`/${user?.role}/dashboard`} replace />
  }

  return <>{children}</>
}

