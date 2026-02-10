// React hooks for managing component state and side effects
import { useState, useEffect } from 'react'
// API layer for user-related backend requests
import { userAPI } from '../../services/api'
// Shared TypeScript types
import type { Service, Appointment, TimeSlot, ServiceOption } from '../../types'

// Main dashboard component for end users
export default function UserDashboard() {
  // List of available services
  const [services, setServices] = useState<Service[]>([])
  // List of user's appointments
  const [appointments, setAppointments] = useState<Appointment[]>([])
  // Search query for services
  const [search, setSearch] = useState('')
  // Global loading flag
  const [loading, setLoading] = useState(true)

  // Load initial data on component mount
  useEffect(() => {
    loadData()
  }, [])

  // Fetch services and appointments concurrently
  const loadData = async () => {
    try {
      const [servicesData, appointmentsData] = await Promise.all([
        userAPI.getServices(),
        userAPI.getAppointments(),
      ])
      // Update state with fetched data
      setServices(filterServices(servicesData, search))
      setAppointments(appointmentsData)
    } catch (error) {
      // Log data loading errors
      console.error('Failed to load data:', error)
    } finally {
      // Stop loading indicator
      setLoading(false)
    }
  }

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

// Card component displaying a single service and booking form
function ServiceCard({ service, onBookingSuccess }: { service: Service; onBookingSuccess: () => void }) {
  // Toggle booking form visibility
  const [showBooking, setShowBooking] = useState(false)
  // Selected date for calendar
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  // Current month being viewed in calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  // Available time slots for selected date
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  // Selected time slot for booking
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  // Optional user notes
  const [notes, setNotes] = useState('')
  // Loading states
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingBooking, setLoadingBooking] = useState(false)

  // Fetch time slots when date is selected
  useEffect(() => {
    if (selectedDate && showBooking) {
      fetchTimeSlots()
    }
  }, [selectedDate, showBooking, service.id])

  const fetchTimeSlots = async () => {
    if (!selectedDate) return
    
    setLoadingSlots(true)
    try {
      // Format date for API (start and end of selected day)
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      // Convert to ISO string for API
      const startDateStr = startOfDay.toISOString()
      const endDateStr = endOfDay.toISOString()
      
      console.log('Fetching slots for service:', service.id, 'from', startDateStr, 'to', endDateStr)
      
      const slots = await userAPI.getAvailableSlots(service.id, startDateStr, endDateStr)
      
      console.log('Received slots:', slots)
      
      // Filter slots to only show those that fall within the selected day
      const daySlots = slots.filter(slot => {
        const slotDate = new Date(slot.start_time)
        return slotDate >= startOfDay && slotDate <= endOfDay
      })
      
      // Sort slots by time
      const sortedSlots = daySlots.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      
      console.log('Filtered and sorted slots:', sortedSlots)
      setTimeSlots(sortedSlots)
    } catch (error) {
      console.error('Failed to fetch time slots:', error)
      setTimeSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  // Submit appointment booking request
  const handleBook = async () => {
    // Prevent submission without a time slot
    if (!selectedSlot) return
    setLoadingBooking(true)
    try {
      await userAPI.createAppointment({
        service_id: service.id,
        start_time: selectedSlot.start_time,
        notes,
      })
      // Notify user of success
      alert('Appointment requested successfully!')
      // Close booking form and reset state
      setShowBooking(false)
      setSelectedDate(null)
      setSelectedSlot(null)
      setNotes('')
      // Refresh data without reloading page
      onBookingSuccess()
    } catch (error: any) {
      // Display API error message if available
      alert(error.response?.data?.error || 'Failed to book appointment')
    } finally {
      // Stop loading indicator
      setLoadingBooking(false)
    }
  }

  // Navigate to previous month
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() - 1)
    setCurrentMonth(newMonth)
  }

  // Navigate to next month
  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() + 1)
    setCurrentMonth(newMonth)
  }

  // Format month and year for display
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const days: Date[] = []
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    // Get first day of month
    const firstDay = new Date(year, month, 1)
    // Get last day of month
    const lastDay = new Date(year, month + 1, 0)
    
    // Get first day of week (0 = Sunday, 1 = Monday, etc.)
    const startDayOfWeek = firstDay.getDay()
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(new Date(year, month, -startDayOfWeek + i + 1))
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }
    
    // Fill remaining cells to complete the grid (up to 42 cells for 6 weeks)
    const remainingCells = 42 - days.length
    for (let i = 1; i <= remainingCells; i++) {
      days.push(new Date(year, month + 1, i))
    }
    
    return days
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Format time for display
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
      {/* Service details */}
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

      {/* Toggle booking form */}
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

      {/* Conditional booking form */}
      {showBooking && (
        <div style={{ marginTop: '1rem' }}>
          {/* Calendar */}
          <div style={{ marginBottom: '1rem' }}>
            <h5 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select a Date</h5>
            
            {/* Month Navigation */}
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
                onClick={goToPreviousMonth}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                }}
              >
                ← Previous
              </button>
              
              <h4 style={{
                margin: 10,
                textAlign: 'center',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                color: '#2c3e50',
              }}>
                {formatMonthYear(currentMonth)}
              </h4>
              
              <button
                onClick={goToNextMonth}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                }}
              >
                Next →
              </button>
            </div>

            {/* Day labels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.25rem',
              marginBottom: '0.5rem',
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    color: '#666',
                    padding: '0.25rem',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(7, 1fr)', 
              gap: '0.5rem',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
            }}>
              {generateCalendarDays().map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                const isSelected = selectedDate?.toDateString() === date.toDateString()
                const isTodayDate = isToday(date)
                
                return (
                  <button
                    key={index}
                    onClick={() => isCurrentMonth && setSelectedDate(date)}
                    disabled={!isCurrentMonth}
                    style={{
                      padding: '0.5rem',
                      border: isSelected
                        ? '2px solid #3498db' 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: isSelected
                        ? '#e3f2fd'
                        : isTodayDate && isCurrentMonth
                        ? '#fff9c4'
                        : isCurrentMonth
                        ? 'white'
                        : '#f5f5f5',
                      cursor: isCurrentMonth ? 'pointer' : 'not-allowed',
                      fontSize: '0.75rem',
                      fontWeight: isTodayDate && isCurrentMonth ? 'bold' : 'normal',
                      color: isCurrentMonth ? '#333' : '#ccc',
                      opacity: isCurrentMonth ? 1 : 0.5,
                    }}
                  >
                    <div>{date.getDate()}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Slots */}
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
                    // Check availability: slot is available if available is true/undefined AND is_booked is false/undefined
                    const isAvailable = (slot.available !== false && slot.available !== undefined) && 
                                       (slot.is_booked === false || slot.is_booked === undefined)
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

          {/* Notes and Booking Button */}
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

// Card component displaying a single appointment
function AppointmentCard({ appointment }: { appointment: Appointment }) {
  // Mapping of appointment statuses to colors
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
      {/* Appointment details */}
      <div>
        <h4>{appointment.service?.name}</h4>
        <p>Master: {appointment.master?.user?.name}</p>
        <p>Time: {new Date(appointment.start_time).toLocaleString()}</p>
        {appointment.notes && <p>Notes: {appointment.notes}</p>}
      </div>

      {/* Appointment status badge */}
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
