import { useState, useCallback, useEffect } from 'react'
import { userAPI, getApiErrorMessage } from '../../services/api'
import type { Service, TimeSlot, ServiceOption } from '../../types'
import Calendar from '../../components/Calendar'

interface ServiceCardProps {
  service: Service
  onBookingSuccess: () => void
}

type ModalView = 'options' | 'calendar' | 'slots'

export default function ServiceCard({ service, onBookingSuccess }: ServiceCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [view, setView] = useState<ModalView>('calendar')
  const [selectedOption, setSelectedOption] = useState<ServiceOption | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [notes, setNotes] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingBooking, setLoadingBooking] = useState(false)

  const hasOptions = (service.options?.length ?? 0) > 0

  const openModal = () => {
    setModalOpen(true)
    setView(hasOptions ? 'options' : 'calendar')
    setSelectedOption(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setNotes('')
    setTimeSlots([])
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedOption(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setNotes('')
    setTimeSlots([])
  }

  const fetchTimeSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true)
    try {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      const slots = await userAPI.getAvailableSlots(
        service.id,
        startOfDay.toISOString(),
        endOfDay.toISOString()
      )

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
  }, [service.id])

  useEffect(() => {
    if (selectedDate && modalOpen && view === 'slots') {
      fetchTimeSlots(selectedDate)
    }
  }, [selectedDate, modalOpen, view, fetchTimeSlots])

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setView('slots')
  }

  const goToPrevDay = () => {
    if (!selectedDate) return
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (prev >= today) {
      setSelectedDate(prev)
      setSelectedSlot(null)
    }
  }

  const goToNextDay = () => {
    if (!selectedDate) return
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setSelectedDate(next)
    setSelectedSlot(null)
  }

  const isPrevDayDisabled = () => {
    if (!selectedDate) return true
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return prev < today
  }

  const handleBook = async () => {
    if (!selectedSlot) return
    if (hasOptions && !selectedOption) return
    setLoadingBooking(true)
    try {
      await userAPI.createAppointment({
        service_id: service.id,
        ...(selectedOption ? { service_option_id: selectedOption.id } : {}),
        start_time: selectedSlot.start_time,
        notes,
      })
      alert('Appointment requested successfully!')
      closeModal()
      onBookingSuccess()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to book appointment'))
    } finally {
      setLoadingBooking(false)
    }
  }

  const formatDateLong = (date: Date) => {
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
      {hasOptions ? (
        <>
          <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem' }}>
            Sub-categories available — select one when booking.
          </p>
          <ul style={{ margin: '0.25rem 0 0.5rem', paddingLeft: '1.25rem' }}>
            {service.options!.map((opt: ServiceOption) => (
              <li key={opt.id} style={{ fontSize: '0.85rem', color: '#555' }}>
                {opt.name} — {opt.duration} min • AMD {opt.price}
              </li>
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
        onClick={openModal}
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

      {/* Booking Modal */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.75rem',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#999',
                lineHeight: 1,
                padding: '0.25rem',
              }}
            >
              ✕
            </button>

            {/* Modal header */}
            <h4 style={{ margin: '0 0 0.25rem', paddingRight: '1.5rem' }}>{service.name}</h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#666' }}>
              {service.master?.user?.name}
            </p>

            {/* View: Sub-category picker */}
            {view === 'options' && hasOptions && (
              <div>
                <h5 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Select a Sub-category
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {service.options!.map((opt: ServiceOption) => {
                    const isSelected = selectedOption?.id === opt.id
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setSelectedOption(opt)
                          setSelectedSlot(null)
                          setView('calendar')
                        }}
                        style={{
                          padding: '0.6rem 0.75rem',
                          border: isSelected ? '2px solid #27ae60' : '1px solid #ddd',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#e8f5e9' : '#fafafa',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{opt.name}</div>
                        {opt.description && (
                          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.15rem' }}>{opt.description}</div>
                        )}
                        <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.15rem' }}>
                          {opt.duration} min • AMD {opt.price}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* View: Month calendar */}
            {view === 'calendar' && (
              <div>
                {selectedOption && (
                  <div style={{
                    padding: '0.4rem 0.65rem',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #c8e6c9',
                    borderRadius: '4px',
                    marginBottom: '0.75rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span>
                      <strong>{selectedOption.name}</strong> — {selectedOption.duration} min • AMD {selectedOption.price}
                    </span>
                    <button
                      onClick={() => { setView('options'); setSelectedOption(null); setSelectedSlot(null) }}
                      style={{ background: 'none', border: 'none', color: '#27ae60', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Change
                    </button>
                  </div>
                )}
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  minDate={new Date()}
                />
              </div>
            )}

            {/* View: Day slots */}
            {view === 'slots' && selectedDate && (
              <div>
                {/* Selected option summary */}
                {selectedOption && (
                  <div style={{
                    padding: '0.4rem 0.65rem',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #c8e6c9',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    fontSize: '0.8rem',
                  }}>
                    <strong>{selectedOption.name}</strong> — {selectedOption.duration} min • AMD {selectedOption.price}
                  </div>
                )}

                {/* Back to calendar link */}
                <button
                  onClick={() => { setView('calendar'); setSelectedSlot(null) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3498db',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: 0,
                    marginBottom: '0.5rem',
                    textDecoration: 'underline',
                  }}
                >
                  ← Back to calendar
                </button>

                {/* Day navigation */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                }}>
                  <button
                    onClick={goToPrevDay}
                    disabled={isPrevDayDisabled()}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: isPrevDayDisabled() ? '#ccc' : '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isPrevDayDisabled() ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    ← Prev
                  </button>
                  <h4 style={{
                    margin: 0,
                    textAlign: 'center',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                  }}>
                    {formatDateLong(selectedDate)}
                  </h4>
                  <button
                    onClick={goToNextDay}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    Next →
                  </button>
                </div>

                {/* Slot list */}
                {loadingSlots ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666' }}>
                    Loading slots...
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666' }}>
                    <p style={{ margin: 0 }}>No time slots available for this date.</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#999' }}>
                      Try another day or check back later.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '280px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}>
                    {timeSlots.map((slot, index) => {
                      const isAvailable = slot.available === true && !slot.is_booked
                      const isChosen = selectedSlot?.start_time === slot.start_time
                      return (
                        <div
                          key={index}
                          onClick={() => isAvailable && setSelectedSlot(slot)}
                          style={{
                            padding: '0.65rem 0.75rem',
                            backgroundColor: isAvailable
                              ? (isChosen ? '#c8e6c9' : '#e8f5e9')
                              : '#ffebee',
                            border: isChosen
                              ? '2px solid #4caf50'
                              : '1px solid #ddd',
                            borderRadius: '6px',
                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                            opacity: isAvailable ? 1 : 0.6,
                            transition: 'all 0.15s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                              {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                              {isAvailable ? 'Available' : 'Booked'}
                            </div>
                          </div>
                          {isChosen && (
                            <span style={{ color: '#4caf50', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Confirm section */}
                {selectedSlot && (
                  <div style={{ marginTop: '0.75rem' }}>
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
                        minHeight: '50px',
                        boxSizing: 'border-box',
                        fontSize: '0.85rem',
                      }}
                    />
                    <button
                      onClick={handleBook}
                      disabled={loadingBooking}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loadingBooking ? 'not-allowed' : 'pointer',
                        opacity: loadingBooking ? 0.6 : 1,
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      {loadingBooking
                        ? 'Booking...'
                        : `Confirm Booking for ${formatTime(selectedSlot.start_time)}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
