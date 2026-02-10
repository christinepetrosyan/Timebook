import { useState, useEffect } from 'react'
import { masterAPI, getApiErrorMessage } from '../../services/api'
import type { Service, Appointment } from '../../types'

export default function MasterDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [servicesData, appointmentsData] = await Promise.all([
        masterAPI.getServices(),
        masterAPI.getAppointments(),
      ])
      setServices(servicesData)
      setAppointments(appointmentsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h2>Master Dashboard</h2>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>My Services</h3>
          <button
            onClick={() => setShowServiceForm(!showServiceForm)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showServiceForm ? 'Cancel' : 'Add Service'}
          </button>
        </div>
        {showServiceForm && <ServiceForm onSuccess={() => {
          setShowServiceForm(false)
          loadData()
        }} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {services.map((service) => (
            <div
              key={service.id}
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
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3>Appointment Requests</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map((appointment) => (
            <AppointmentRequestCard key={appointment.id} appointment={appointment} onUpdate={loadData} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ServiceForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 60,
    price: 0,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await masterAPI.createService(formData)
      onSuccess()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to create service'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: 'white',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Service Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Duration (minutes)</label>
          <input
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            required
            min="1"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Price</label>
          <input
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
            min="0"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Creating...' : 'Create Service'}
      </button>
    </form>
  )
}

function AppointmentRequestCard({ appointment, onUpdate }: { appointment: Appointment; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await masterAPI.confirmAppointment(appointment.id)
      onUpdate()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to confirm appointment'))
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    try {
      await masterAPI.rejectAppointment(appointment.id)
      onUpdate()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to reject appointment'))
    } finally {
      setLoading(false)
    }
  }

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
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <h4>{appointment.service?.name}</h4>
          <p>Client: {appointment.user?.name}</p>
          <p>Email: {appointment.user?.email}</p>
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
      {appointment.status === 'pending' && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Processing...' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  )
}

