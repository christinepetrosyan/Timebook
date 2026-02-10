import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { getApiErrorMessage } from '../services/api'

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'user',
  })
  const [error, setError] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await register(formData)
      navigate(`/${formData.role}/dashboard`)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Registration failed'))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Register for Timebook</h2>
        <p style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: '#3498db', fontSize: '0.9rem' }}>
            Back to home
          </Link>
        </p>
        {error && (
          <div
            style={{
              backgroundColor: '#fee',
              color: '#c33',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Name</label>
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
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Role</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="user">User</option>
            <option value="master">Master</option>
          </select>
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Register
        </button>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#3498db' }}>
            Login
          </a>
        </p>
      </form>
    </div>
  )
}

