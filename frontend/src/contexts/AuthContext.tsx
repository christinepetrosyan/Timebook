import { createContext, useContext, useState, ReactNode } from 'react'
import { authAPI } from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    name: string
    phone?: string
    role?: string
  }) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem('token')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [token, setToken] = useState<string | null>(getStoredToken)

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password)
    setToken(response.token)
    setUser(response.user)
    localStorage.setItem('token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))
  }

  const register = async (data: {
    email: string
    password: string
    name: string
    phone?: string
    role?: string
  }) => {
    const response = await authAPI.register(data)
    setToken(response.token)
    setUser(response.user)
    localStorage.setItem('token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

