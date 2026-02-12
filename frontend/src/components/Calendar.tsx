import { useState, useMemo, useCallback } from 'react'

interface CalendarProps {
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  variant?: 'full' | 'compact'
  minDate?: Date
  maxDate?: Date
}

export default function Calendar({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate || new Date())

  // Navigate to previous month (memoized)
  const goToPreviousMonth = useCallback(() => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() - 1)
    setCurrentMonth(newMonth)
  }, [currentMonth])

  // Navigate to next month (memoized)
  const goToNextMonth = useCallback(() => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() + 1)
    setCurrentMonth(newMonth)
  }, [currentMonth])

  // Format month and year for display (memoized)
  const formattedMonthYear = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [currentMonth])

  // Generate calendar days for the current month (memoized)
  const calendarDays = useMemo(() => {
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
  }, [currentMonth])

  // Check if date is today (memoized)
  const isToday = useCallback((date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }, [])

  // Check if date is disabled (memoized)
  const isDateDisabled = useCallback((date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }, [minDate, maxDate])

  return (
    <div style={{ marginBottom: '1rem' }}>
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
          margin: 0,
          textAlign: 'center',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          color: '#2c3e50',
        }}>
          {formattedMonthYear}
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
      
      {/* Calendar grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '0.5rem',
        padding: '0.5rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: 'white',
      }}>
        {calendarDays.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
          const isSelected = selectedDate?.toDateString() === date.toDateString()
          const isTodayDate = isToday(date)
          const isDisabled = isDateDisabled(date)
          
          return (
            <button
              key={index}
              onClick={() => isCurrentMonth && !isDisabled && onDateSelect(date)}
              disabled={!isCurrentMonth || isDisabled}
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
                cursor: isCurrentMonth && !isDisabled ? 'pointer' : 'not-allowed',
                fontSize: '0.75rem',
                fontWeight: isTodayDate && isCurrentMonth ? 'bold' : 'normal',
                color: isDisabled ? '#999' : isCurrentMonth ? '#333' : '#ccc',
                opacity: isCurrentMonth && !isDisabled ? 1 : 0.5,
              }}
            >
              <div>{date.getDate()}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}