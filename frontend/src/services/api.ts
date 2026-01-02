import axios from 'axios'
import type { AuthResponse, User, Service, Appointment, TimeSlot, MasterProfile } from '../types'

// Use relative URL in production (via nginx proxy) or absolute URL in development
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth API
export const authAPI = {
  register: async (data: {
    email: string
    password: string
    name: string
    phone?: string
    role?: string
  }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data)
    return response.data
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password })
    return response.data
  },
}

// User API
export const userAPI = {
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/user/profile')
    return response.data
  },

  getServices: async (search?: string, masterId?: number): Promise<Service[]> => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (masterId) params.append('master_id', masterId.toString())
    const response = await api.get<Service[]>(`/services?${params.toString()}`)
    return response.data
  },

  getAvailableSlots: async (serviceId: number): Promise<TimeSlot[]> => {
    const response = await api.get<TimeSlot[]>(`/services/${serviceId}/slots`)
    return response.data
  },

  createAppointment: async (data: {
    service_id: number
    start_time: string
    notes?: string
  }): Promise<Appointment> => {
    const response = await api.post<Appointment>('/appointments', data)
    return response.data
  },

  getAppointments: async (): Promise<Appointment[]> => {
    const response = await api.get<Appointment[]>('/appointments')
    return response.data
  },
}

// Master API
export const masterAPI = {
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/master/profile')
    return response.data
  },

  createService: async (data: {
    name: string
    description?: string
    duration: number
    price: number
  }): Promise<Service> => {
    const response = await api.post<Service>('/master/services', data)
    return response.data
  },

  getServices: async (): Promise<Service[]> => {
    const response = await api.get<Service[]>('/master/services')
    return response.data
  },

  getAppointments: async (): Promise<Appointment[]> => {
    const response = await api.get<Appointment[]>('/master/appointments')
    return response.data
  },

  confirmAppointment: async (appointmentId: number): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/master/appointments/${appointmentId}/confirm`)
    return response.data
  },

  rejectAppointment: async (appointmentId: number): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/master/appointments/${appointmentId}/reject`)
    return response.data
  },
}

// Admin API
export const adminAPI = {
  getMasters: async (): Promise<MasterProfile[]> => {
    const response = await api.get<MasterProfile[]>('/admin/masters')
    return response.data
  },

  getAllAppointments: async (masterId?: number, status?: string): Promise<Appointment[]> => {
    const params = new URLSearchParams()
    if (masterId) params.append('master_id', masterId.toString())
    if (status) params.append('status', status)
    const response = await api.get<Appointment[]>(`/admin/appointments?${params.toString()}`)
    return response.data
  },

  confirmAppointment: async (appointmentId: number): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/admin/appointments/${appointmentId}/confirm`)
    return response.data
  },

  rejectAppointment: async (appointmentId: number): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/admin/appointments/${appointmentId}/reject`)
    return response.data
  },
}

export default api

