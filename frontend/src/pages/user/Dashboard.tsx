import { useState, useEffect } from 'react'
import { userAPI } from '../../services/api'
import type { Service, Appointment } from '../../types'

export default function UserDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [servicesData, appointmentsData] = await Promise.all([
        userAPI.getServices(search),
        userAPI.getAppointments(),
      ])
      setServices(servicesData)
      setAppointments(appointmentsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const data = await userAPI.getServices(search)
      setServices(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2>User Dashboard</h2>
      <div style={{ marginBottom: '2rem' }}>
        <h3>Find Services</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search services..."
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
            onClick={handleSearch}
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
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
      <div>
        <h3>My Appointments</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ServiceCard({ service }: { service: Service }) {
  const [showBooking, setShowBooking] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleBook = async () => {
    if (!selectedSlot) return
    setLoading(true)
    try {
      await userAPI.createAppointment({
        service_id: service.id,
        start_time: selectedSlot,
        notes,
      })
      alert('Appointment requested successfully!')
      setShowBooking(false)
      window.location.reload()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to book appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: 'white',
      }}
    >
      <h4>{service.name}</h4>
      <p>{service.description}</p>
      <p>Duration: {service.duration} minutes</p>
      <p>Price: ${service.price}</p>
      <button
        onClick={() => setShowBooking(!showBooking)}
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Book Appointment
      </button>
      {showBooking && (
        <div style={{ marginTop: '1rem' }}>
          <input
            type="datetime-local"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={handleBook}
            disabled={loading || !selectedSlot}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      )}
    </div>
  )
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const statusColors: Record<string, string> = {
    pending: '#f39c12',
    confirmed: '#27ae60',
    rejected: '#e74c3c',
    cancelled: '#95a5a6',
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <h4>{appointment.service?.name}</h4>
        <p>Master: {appointment.master?.user?.name}</p>
        <p>Time: {new Date(appointment.start_time).toLocaleString()}</p>
        {appointment.notes && <p>Notes: {appointment.notes}</p>}
      </div>
      <span
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: statusColors[appointment.status] || '#95a5a6',
          color: 'white',
          borderRadius: '4px',
          textTransform: 'capitalize',
        }}
      >
        {appointment.status}
      </span>
    </div>
  )
}

