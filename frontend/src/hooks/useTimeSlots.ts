import { useQuery } from '@tanstack/react-query'
import { userAPI, masterAPI } from '../services/api'

/**
 * Hook to fetch available time slots for a service
 */
export function useAvailableSlots(serviceId: number, startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: ['timeSlots', serviceId, startDate, endDate],
    queryFn: () => userAPI.getAvailableSlots(serviceId, startDate, endDate),
    enabled: enabled && !!serviceId && !!startDate && !!endDate,
  })
}

/**
 * Hook to fetch master's time slots
 */
export function useMasterTimeSlots(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: ['master', 'timeSlots', startDate, endDate],
    queryFn: () => masterAPI.getTimeSlots({ start_date: startDate, end_date: endDate }),
    enabled: enabled && !!startDate && !!endDate,
  })
}
