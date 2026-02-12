import type { Appointment } from '../../types'

interface AppointmentCardProps {
  appointment: Appointment
}

const statusColors: Record<string, string> = {
  pending: '#f39c12',
  confirmed: '#27ae60',
  rejected: '#e74c3c',
  cancelled: '#95a5a6',
}

export default function AppointmentCard({ appointment }: AppointmentCardProps) {
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
