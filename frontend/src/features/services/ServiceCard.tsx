import { useState, useCallback, useEffect } from 'react'
import { userAPI, getApiErrorMessage } from '../../services/api'
import type { Service, TimeSlot, ServiceOption } from '../../types'
import Calendar from '../../components/Calendar'

interface ServiceCardProps {
  service: Service
  onBookingSuccess: () => void
}

export default function ServiceCard({ service, onBookingSuccess }: ServiceCardProps) {
  const [showBooking, setShowBooking] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [notes, setNotes] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingBooking, setLoadingBooking] = useState(false)

  const fetchTimeSlots = useCallback(async () => {
    if (!selectedDate) return
    
    setLoadingSlots(true)
    try {
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      const startDateStr = startOfDay.toISOString()
      const endDateStr = endOfDay.toISOString()
      
      const slots = await userAPI.getAvailableSlots(service.id, startDateStr, endDateStr)
      
      const daySlots = slots.filter(slot => {
        const slotDate = new Date(slot.start_time)
        return slotDate >= startOfDay && slotDate <= endOfDay
      })
      
      const sortedSlots = daySlots.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      
      setTimeSlots(sortedSlots)
    } catch (error) {
      console.error('Failed to fetch time slots:', error)
      setTimeSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedDate, service.id])

  useEffect(() => {
    if (selectedDate && showBooking) {
      fetchTimeSlots()
    }
  }, [selectedDate, showBooking, fetchTimeSlots])

  const handleBook = async () => {
    if (!selectedSlot) return
    setLoadingBooking(true)
    try {
      await userAPI.createAppointment({
        service_id: service.id,
        start_time: selectedSlot.start_time,
        notes,
      })
      alert('Appointment requested successfully!')
      setShowBooking(false)
      setSelectedDate(null)
      setSelectedSlot(null)
      setNotes('')
      onBookingSuccess()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to book appointment'))
    } finally {
      setLoadingBooking(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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
      <p>Master: {service.master?.user?.name}</p>
      <p>{service.description}</p>
      {service.options && service.options.length > 0 ? (
        <>
          <p style={{ marginBottom: '0.25rem' }}>Sub-categories (duration • price):</p>
          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
            {service.options.map((opt: ServiceOption) => (
              <li key={opt.id}>{opt.name} — {opt.duration} min • AMD {opt.price}</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>Duration: {service.duration} minutes</p>
          <p>Price: AMD {service.price}</p>
        </>
      )}

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
          <div>
            <h5 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select a Date</h5>
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={(date) => setSelectedDate(date)}
              minDate={new Date()}
            />
          </div>

          {selectedDate && (
            <div style={{ marginBottom: '1rem' }}>
              <h5 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Available Slots for {formatDate(selectedDate)}
              </h5>
              {loadingSlots ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                  Loading slots...
                </div>
              ) : timeSlots.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                  <p>No time slots available for this date.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    The master hasn't created any time slots for this service yet.
                  </p>
                </div>
              ) : (
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '0.5rem',
                }}>
                  {timeSlots.map((slot, index) => {
                    const isAvailable = slot.available === true && !slot.is_booked
                    return (
                      <div
                        key={index}
                        onClick={() => isAvailable && setSelectedSlot(slot)}
                        style={{
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          backgroundColor: isAvailable 
                            ? (selectedSlot?.start_time === slot.start_time ? '#c8e6c9' : '#e8f5e9')
                            : '#ffebee',
                          border: selectedSlot?.start_time === slot.start_time 
                            ? '2px solid #4caf50' 
                            : '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          opacity: isAvailable ? 1 : 0.6,
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>
                              {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              {isAvailable ? 'Available' : 'Booked'}
                            </div>
                          </div>
                          {selectedSlot?.start_time === slot.start_time && (
                            <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {selectedSlot && (
            <>
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
                  minHeight: '60px',
                }}
              />
              <button
                onClick={handleBook}
                disabled={loadingBooking || !selectedSlot}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loadingBooking || !selectedSlot ? 'not-allowed' : 'pointer',
                  opacity: loadingBooking || !selectedSlot ? 0.6 : 1,
                }}
              >
                {loadingBooking ? 'Booking...' : `Confirm Booking for ${formatTime(selectedSlot.start_time)}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
