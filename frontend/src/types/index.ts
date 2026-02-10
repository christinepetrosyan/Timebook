export type UserRole = 'user' | 'master' | 'admin'

export interface User {
  id: number
  email: string
  name: string
  role: UserRole
  phone?: string
  created_at: string
  updated_at: string
}

export interface MasterProfile {
  id: number
  user_id: number
  bio?: string
  specialty?: string
  experience?: number
  user?: User
  services?: Service[]
}

export interface Service {
  id: number
  master_id: number
  name: string
  description?: string
  duration: number
  price: number
  master?: MasterProfile
  options?: ServiceOption[]
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'

export interface Appointment {
  id: number
  user_id: number
  master_id: number
  service_id: number
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes?: string
  user?: User
  master?: MasterProfile
  service?: Service
}

export interface TimeSlot {
  id?: number
  master_id: number
  service_id: number
  start_time: string
  end_time: string
  is_booked: boolean
  available?: boolean // Computed field for display
  service?: Service
  master?: MasterProfile
}

export interface ServiceOption {
  id: number
  service_id: number
  name: string
  description?: string
  duration: number
  price: number
}

export interface AuthResponse {
  token: string
  user: User
}

