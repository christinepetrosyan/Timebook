import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

export default function Landing() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/${user.role}/dashboard`, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  if (isAuthenticated && user) {
    return null
  }

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }

  const linkStyle: React.CSSProperties = {
    color: 'white',
    textDecoration: 'none',
    marginLeft: '1rem',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    flex: '1',
    minWidth: '200px',
    maxWidth: '320px',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Timebook</h1>
        <nav>
          <Link to="/login" style={linkStyle}>
            Login
          </Link>
          <Link to="/register" style={linkStyle}>
            Register
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <section
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            maxWidth: '640px',
            margin: '0 auto',
          }}
        >
          <h2
            style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: '#2c3e50',
            }}
          >
            Book appointments. Manage your calendar.
          </h2>
          <p
            style={{
              fontSize: '1.125rem',
              color: '#555',
              marginBottom: '2rem',
              lineHeight: 1.6,
            }}
          >
            Timebook is an online appointment management system. Find services, pick
            time slots, and get confirmations—or run your own schedule as a master.
          </p>
          <Link
            to="/register"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3498db',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            Get started
          </Link>
        </section>

        <section
          style={{
            padding: '2rem',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          <h3
            style={{
              textAlign: 'center',
              marginBottom: '2rem',
              color: '#2c3e50',
              fontSize: '1.5rem',
            }}
          >
            For everyone
          </h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
              justifyContent: 'center',
            }}
          >
            <div style={cardStyle}>
              <h4 style={{ marginBottom: '0.75rem', color: '#2c3e50' }}>Users</h4>
              <p style={{ color: '#555', lineHeight: 1.6, margin: 0 }}>
                Find services and organizations, select available time slots, book
                appointments, and receive notifications when your booking is
                confirmed.
              </p>
            </div>
            <div style={cardStyle}>
              <h4 style={{ marginBottom: '0.75rem', color: '#2c3e50' }}>Masters</h4>
              <p style={{ color: '#555', lineHeight: 1.6, margin: 0 }}>
                Register and list your services, receive appointment requests,
                confirm or reject bookings, and manage your calendar in one place.
              </p>
            </div>
            <div style={cardStyle}>
              <h4 style={{ marginBottom: '0.75rem', color: '#2c3e50' }}>Admins</h4>
              <p style={{ color: '#555', lineHeight: 1.6, margin: 0 }}>
                Manage masters' appointments and oversee organization operations
                across your business.
              </p>
            </div>
          </div>
        </section>

        <section
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            backgroundColor: 'white',
            borderTop: '1px solid #eee',
          }}
        >
          <p style={{ marginBottom: '1rem', color: '#555' }}>
            Already have an account? Log in or sign up to get started.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/login"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: '#3498db',
                textDecoration: 'none',
                borderRadius: '4px',
                border: '1px solid #3498db',
                fontSize: '1rem',
              }}
            >
              Log in
            </Link>
            <Link
              to="/register"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3498db',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              Sign up
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
