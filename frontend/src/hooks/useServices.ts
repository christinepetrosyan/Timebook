import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userAPI, masterAPI } from '../services/api'
import type { Service } from '../types'

/**
 * Hook to fetch all services (user view)
 */
export function useServices(search?: string) {
  return useQuery({
    queryKey: ['services', search],
    queryFn: async () => {
      const services = await userAPI.getServices()
      if (!search) return services
      
      const q = search.trim().toLowerCase()
      return services.filter((s) => {
        const serviceName = (s.name || '').toLowerCase()
        const masterName = (s.master?.user?.name || '').toLowerCase()
        return serviceName.includes(q) || masterName.includes(q)
      })
    },
  })
}

/**
 * Hook to fetch master's services
 */
export function useMasterServices() {
  return useQuery({
    queryKey: ['master', 'services'],
    queryFn: () => masterAPI.getServices(),
  })
}

/**
 * Hook to create a new service
 */
export function useCreateService() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: { name: string; description: string; duration: number; price: number }) =>
      masterAPI.createService(data),
    onSuccess: () => {
      // Invalidate and refetch services
      queryClient.invalidateQueries({ queryKey: ['master', 'services'] })
    },
  })
}

/**
 * Hook to update a service
 */
export function useUpdateService() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Service> }) =>
      masterAPI.updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master', 'services'] })
    },
  })
}

/**
 * Hook to delete a service
 */
export function useDeleteService() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => masterAPI.deleteService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master', 'services'] })
    },
  })
}
