import { useState, ReactNode } from 'react'
import { authAPI } from '../services/api'
import type { User, AuthResponse } from '../types'
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
    if ('requires_verification' in response && response.requires_verification) {
      return response
    }
    const auth = response as AuthResponse
    setToken(auth.token)
    setUser(auth.user)
    localStorage.setItem('token', auth.token)
    localStorage.setItem('user', JSON.stringify(auth.user))
    return auth
  }

  const verifyEmail = async (email: string, code: string) => {
    const response = await authAPI.verifyEmail(email, code)
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
        verifyEmail,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
