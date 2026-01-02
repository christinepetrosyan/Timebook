import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import type { MasterProfile, Appointment } from '../../types'

export default function AdminDashboard() {
  const [masters, setMasters] = useState<MasterProfile[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedMaster, setSelectedMaster] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [selectedMaster, statusFilter])

  const loadData = async () => {
    try {
      const [mastersData, appointmentsData] = await Promise.all([
        adminAPI.getMasters(),
        adminAPI.getAllAppointments(selectedMaster, statusFilter || undefined),
      ])
      setMasters(mastersData)
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
      <h2>Admin Dashboard</h2>
      <div style={{ marginBottom: '2rem' }}>
        <h3>Masters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {masters.map((master) => (
            <div
              key={master.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: 'white',
              }}
            >
              <h4>{master.user?.name}</h4>
              <p>Email: {master.user?.email}</p>
              <p>Specialty: {master.specialty || 'N/A'}</p>
              <p>Experience: {master.experience || 0} years</p>
              <p>Services: {master.services?.length || 0}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>All Appointments</h3>
          <select
            value={selectedMaster || ''}
            onChange={(e) => setSelectedMaster(e.target.value ? parseInt(e.target.value) : undefined)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="">All Masters</option>
            {masters.map((master) => (
              <option key={master.id} value={master.id}>
                {master.user?.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map((appointment) => (
            <AdminAppointmentCard key={appointment.id} appointment={appointment} onUpdate={loadData} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminAppointmentCard({ appointment, onUpdate }: { appointment: Appointment; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await adminAPI.confirmAppointment(appointment.id)
      onUpdate()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to confirm appointment')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    try {
      await adminAPI.rejectAppointment(appointment.id)
      onUpdate()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject appointment')
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
          <p>Client: {appointment.user?.name} ({appointment.user?.email})</p>
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

