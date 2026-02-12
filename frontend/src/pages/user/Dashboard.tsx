// React hooks for managing component state and side effects
import { useState, useEffect, useCallback } from 'react'
// API layer for user-related backend requests
import { userAPI } from '../../services/api'
// Shared TypeScript types
import type { Service, Appointment } from '../../types'
// Feature components
import ServiceCard from '../../features/services/ServiceCard'
import AppointmentCard from '../../features/appointments/AppointmentCard'
// Custom hooks
import { useDebounce } from '../../hooks/useDebounce'

// Main dashboard component for end users
export default function UserDashboard() {
  // List of available services
  const [services, setServices] = useState<Service[]>([])
  // List of user's appointments
  const [appointments, setAppointments] = useState<Appointment[]>([])
  // Search query for services
  const [search, setSearch] = useState('')
  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, 300)
  // Global loading flag
  const [loading, setLoading] = useState(true)

  // Fetch services and appointments concurrently
  const loadData = useCallback(async () => {
    try {
      const [servicesData, appointmentsData] = await Promise.all([
        userAPI.getServices(),
        userAPI.getAppointments(),
      ])
      // Update state with fetched data
      setServices(filterServices(servicesData, debouncedSearch))
      setAppointments(appointmentsData)
    } catch (error) {
      // Log data loading errors
      console.error('Failed to load data:', error)
    } finally {
      // Stop loading indicator
      setLoading(false)
    }
  }, [debouncedSearch])

  // Load initial data on component mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Trigger service search based on current query
  const handleSearch = async () => {
    setLoading(true)
    try {
      // Fetch all services, then filter by service name OR master name
      const data = await userAPI.getServices()
      setServices(filterServices(data, search))
    } catch (error) {
      // Log search errors
      console.error('Search failed:', error)
    } finally {
      // Stop loading indicator
      setLoading(false)
    }
  }

  const filterServices = (data: Service[], query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((s) => {
      const serviceName = (s.name || '').toLowerCase()
      const masterName = (s.master?.user?.name || '').toLowerCase()
      return serviceName.includes(q) || masterName.includes(q)
    })
  }

  // Render loading state
  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2>User Dashboard</h2>

      {/* Service search section */}
<div style={{ marginBottom: '2rem' }}>
  <h3>Find Services</h3>

  {/* Search form */}
  <form
    onSubmit={(e) => {
      e.preventDefault(); // Prevent page reload
      handleSearch();      // Trigger search
    }}
    style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}
  >
    <input
      type="text"
      placeholder="Find service or master..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      style={{
        flex: 1,
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
      }}
    />
    <button
      type="submit" // Important: tells the form to submit on click
      style={{
        padding: '0.75rem 1.5rem',
        backgroundColor: '#3498db',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Search
    </button>
  </form>

  {/* Services grid */}
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1rem',
    }}
  >
    {services.map((service) => (
      <ServiceCard key={service.id} service={service} onBookingSuccess={loadData} />
    ))}
  </div>
</div>


      {/* Appointments section */}
      <div>
        <h3>My Appointments</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map((appointment) => (
            // Render individual appointment card
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      </div>
    </div>
  )
}
