import { useState, useEffect } from 'react'
import { userAPI } from '../../services/api'
import type { NotificationPreferences } from '../../types'

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    userAPI
      .getNotificationPreferences()
      .then(setPrefs)
      .catch((err) => {
        setError(err?.response?.data?.error || 'Failed to load preferences')
      })
      .finally(() => setLoading(false))
  }, [])

  const updatePref = async (updates: Partial<NotificationPreferences>) => {
    if (!prefs) return
    setSaving(true)
    setError(null)
    try {
      const updated = await userAPI.updateNotificationPreferences(updates)
      setPrefs(updated)
    } catch (err: unknown) {
      // const msg = err && typeof err === 'object' && 'response' in err
      //   ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
      //   : 'Failed to update'
      // setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '1rem', color: '#666' }}>Loading notification settings...</div>
  if (error && !prefs) return <div style={{ padding: '1rem', color: '#c00' }}>{error}</div>

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
      <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Notification Preferences</h4>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
        Choose how you want to receive appointment updates (confirmations, rejections).
      </p>
      {error && <div style={{ color: '#c00', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs?.email_enabled ?? true}
            onChange={(e) => updatePref({ email_enabled: e.target.checked })}
            disabled={saving}
          />
          <span>Email notifications</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs?.telegram_enabled ?? false}
            onChange={(e) => updatePref({ telegram_enabled: e.target.checked })}
            disabled={saving}
          />
          <span>Telegram</span>
        </label>
        <div style={{ marginLeft: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
          <button
            type="button"
            onClick={async () => {
              try {
                const { bot_link } = await userAPI.getTelegramLink()
                window.open(bot_link, '_blank')
              } catch {
                // Bot not configured
              }
            }}
            style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem' }}
          >
            Link Telegram
          </button>
          Open the bot and send /start to link your account.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs?.whatsapp_enabled ?? false}
            onChange={(e) => updatePref({ whatsapp_enabled: e.target.checked })}
            disabled={saving}
          />
          <span>WhatsApp</span>
        </label>
        {prefs?.whatsapp_enabled && (
          <div style={{ marginLeft: '1.5rem' }}>
            <input
              type="tel"
              placeholder="Phone number (e.g. +1234567890)"
              value={prefs?.whatsapp_phone ?? ''}
              onChange={(e) => setPrefs((p) => (p ? { ...p, whatsapp_phone: e.target.value } : null))}
              onBlur={(e) => updatePref({ whatsapp_phone: e.target.value })}
              style={{ width: '100%', maxWidth: 240, padding: '0.5rem' }}
            />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs?.viber_enabled ?? false}
            onChange={(e) => updatePref({ viber_enabled: e.target.checked })}
            disabled={saving}
          />
          <span>Viber</span>
        </label>
        <div style={{ marginLeft: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
          Subscribe to the Timebook bot in Viber to receive notifications.
        </div>
      </div>
      {saving && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>Saving...</div>}
    </div>
  )
}
