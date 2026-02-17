import axios from 'axios'
import type { AuthResponse, User, Service, Appointment, TimeSlot, MasterProfile, ServiceOption } from '../types'

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

/** Safely get error message from Axios-style or unknown error. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error && typeof response.data.error === 'string') return response.data.error
  }
  return fallback
}

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

  getAvailableSlots: async (serviceId: number, startDate?: string, endDate?: string): Promise<TimeSlot[]> => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const queryString = params.toString()
    const response = await api.get<TimeSlot[]>(`/services/${serviceId}/slots${queryString ? '?' + queryString : ''}`)
    return response.data
  },

  createAppointment: async (data: {
    service_id: number
    service_option_id?: number
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

  updateService: async (serviceId: number, data: {
    name?: string
    description?: string
    duration?: number
    price?: number
  }): Promise<Service> => {
    const response = await api.put<Service>(`/master/services/${serviceId}`, data)
    return response.data
  },

  deleteService: async (serviceId: number): Promise<void> => {
    await api.delete(`/master/services/${serviceId}`)
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

  // Time slot management
  createTimeSlot: async (data: {
    service_id: number
    start_time: string
    end_time: string
  }): Promise<TimeSlot> => {
    const response = await api.post<TimeSlot>('/master/time-slots', data)
    return response.data
  },

  getTimeSlots: async (params?: {
    service_id?: number
    start_date?: string
    end_date?: string
    is_booked?: boolean
  }): Promise<TimeSlot[]> => {
    const queryParams = new URLSearchParams()
    if (params?.service_id) queryParams.append('service_id', params.service_id.toString())
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    if (params?.is_booked !== undefined) queryParams.append('is_booked', params.is_booked.toString())
    
    const response = await api.get<TimeSlot[]>(`/master/time-slots?${queryParams.toString()}`)
    return response.data
  },

  updateTimeSlot: async (timeSlotId: number, data: {
    start_time?: string
    end_time?: string
  }): Promise<TimeSlot> => {
    const response = await api.put<TimeSlot>(`/master/time-slots/${timeSlotId}`, data)
    return response.data
  },

  deleteTimeSlot: async (timeSlotId: number): Promise<void> => {
    await api.delete(`/master/time-slots/${timeSlotId}`)
  },

  toggleTimeSlotBooking: async (data: {
    timeSlotId?: number
    service_id: number
    start_time: string
    end_time: string
    is_booked: boolean
  }): Promise<TimeSlot> => {
    const url = data.timeSlotId 
      ? `/master/time-slots/${data.timeSlotId}/toggle-booking`
      : '/master/time-slots/0/toggle-booking'
    const response = await api.put<TimeSlot>(url, {
      service_id: data.service_id,
      start_time: data.start_time,
      end_time: data.end_time,
      is_booked: data.is_booked,
    })
    return response.data
  },

  // Service options (sub-categories)
  createServiceOption: async (serviceId: number, data: {
    name: string
    description?: string
    duration: number
    price: number
  }): Promise<ServiceOption> => {
    const response = await api.post<ServiceOption>(`/master/services/${serviceId}/options`, data)
    return response.data
  },

  updateServiceOption: async (optionId: number, data: {
    name: string
    description?: string
    duration: number
    price: number
  }): Promise<ServiceOption> => {
    const response = await api.put<ServiceOption>(`/master/service-options/${optionId}`, data)
    return response.data
  },

  deleteServiceOption: async (optionId: number): Promise<void> => {
    await api.delete(`/master/service-options/${optionId}`)
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

