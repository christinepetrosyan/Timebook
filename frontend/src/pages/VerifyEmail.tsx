import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { authAPI, getApiErrorMessage } from '../services/api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const emailFromUrl = searchParams.get('email') || ''
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { verifyEmail } = useAuth()
  const navigate = useNavigate()

  const email = emailFromUrl

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResendMessage('')
    if (!email) {
      setError('Email is missing. Please go back and register again.')
      return
    }
    if (!code.trim()) {
      setError('Please enter the verification code')
      return
    }
    setLoading(true)
    try {
      await verifyEmail(email, code.trim())
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      navigate(`/${user.role}/dashboard`)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Verification failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResendMessage('')
    if (!email) return
    setLoading(true)
    try {
      await authAPI.resendVerificationCode(email)
      setResendMessage('A new code has been sent to your email.')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to resend code'))
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          padding: '2rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            maxWidth: '400px',
          }}
        >
          <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Verification</h2>
          <p style={{ color: '#c33', marginBottom: '1rem' }}>
            Email is missing. Please complete registration first.
          </p>
          <Link to="/register" style={{ color: '#3498db' }}>
            Go to Register
          </Link>
        </div>
      </div>
    )
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
        <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Verify your email</h2>
        <p style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
        </p>
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
        {resendMessage && (
          <div
            style={{
              backgroundColor: '#efe',
              color: '#363',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            {resendMessage}
          </div>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1.25rem',
              letterSpacing: '0.5em',
              textAlign: 'center',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginTop: '0.75rem',
            backgroundColor: 'transparent',
            color: '#3498db',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Resend code
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
