import { useState, ReactNode } from 'react'
import { authAPI } from '../services/api'
import type { User } from '../types'
import { AuthContext } from './authContext'

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
