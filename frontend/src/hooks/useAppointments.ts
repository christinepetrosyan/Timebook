import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userAPI, masterAPI } from '../services/api'

/**
 * Hook to fetch user's appointments
 */
export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: () => userAPI.getAppointments(),
  })
}

/**
 * Hook to fetch master's appointments
 */
export function useMasterAppointments() {
  return useQuery({
    queryKey: ['master', 'appointments'],
    queryFn: () => masterAPI.getAppointments(),
  })
}

/**
 * Hook to create an appointment
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: { service_id: number; start_time: string; notes?: string }) =>
      userAPI.createAppointment(data),
    onSuccess: () => {
      // Invalidate appointments cache
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

/**
 * Hook to confirm an appointment (master)
 */
export function useConfirmAppointment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => masterAPI.confirmAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master', 'appointments'] })
    },
  })
}

/**
 * Hook to reject an appointment (master)
 */
export function useRejectAppointment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => masterAPI.rejectAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master', 'appointments'] })
    },
  })
}
