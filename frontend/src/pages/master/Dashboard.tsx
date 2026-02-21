import { useState, useEffect, useCallback } from 'react'
import { masterAPI, getApiErrorMessage } from '../../services/api'
import type { Service, Appointment, TimeSlot, ServiceOption, User } from '../../types'
import Calendar from '../../components/Calendar'
import { useDebounce } from '../../hooks/useDebounce'

type TabType = 'services' | 'calendar' | 'requests'

export default function MasterDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('services')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoadError(null)
    try {
      const [servicesData, appointmentsData] = await Promise.all([
        masterAPI.getServices(),
        masterAPI.getAppointments(),
      ])
      setServices(Array.isArray(servicesData) ? servicesData : [])
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : [])
    } catch (error: unknown) {
      console.error('Failed to load data:', error)
      const msg = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string }; status?: number } }).response?.data?.error
          || `Request failed (${(error as { response?: { status?: number } }).response?.status || 'error'})`
        : 'Failed to load services and appointments'
      setLoadError(msg)
      setServices([])
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  const tabs: Array<{ id: TabType; label: string }> = [
    { id: 'services', label: 'My Services' },
    { id: 'calendar', label: 'My Calendar' },
    { id: 'requests', label: 'Appointment Requests' },
  ]

  return (
    <div>
      <h2>Master Dashboard</h2>
      {loadError && (
        <div style={{ padding: '1rem', marginBottom: '1rem', background: '#fee', color: '#c00', borderRadius: '4px' }}>
          {loadError}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        borderBottom: '2px solid #ddd',
        marginBottom: '1.5rem',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === tab.id ? '#3498db' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#555',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3498db' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === tab.id ? '600' : '400',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#f0f0f0'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'services' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>My Services</h3>
            <button
              onClick={() => setShowServiceForm(!showServiceForm)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {showServiceForm ? 'Cancel' : 'Add Service'}
            </button>
          </div>
          {showServiceForm && <ServiceForm onSuccess={() => {
            setShowServiceForm(false)
            loadData()
          }} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} onChange={loadData} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div>
          <h3>My Calendar</h3>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
            View all your appointments and manage availability. Click on time slots to mark them as booked (for lunch, phone appointments, etc.) or available.
          </p>
          {services.length === 0 ? (
            <p style={{ color: '#666' }}>Create a service first to see your calendar</p>
          ) : (
            <MasterCalendar services={services} appointments={appointments} onUpdate={loadData} />
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div>
          <h3>Appointment Requests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {appointments.map((appointment) => (
              <AppointmentRequestCard key={appointment.id} appointment={appointment} onUpdate={loadData} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 60,
    price: 0,
  })
  const [loading, setLoading] = useState(false)
  const [isOptionsMode, setIsOptionsMode] = useState(false)

  // Pending sub-categories to create after the service is saved
  const [pendingOptions, setPendingOptions] = useState<Array<{ name: string; description: string; duration: number; price: number }>>([])
  const [newOption, setNewOption] = useState({ name: '', description: '', duration: 60, price: 0 })

  const addPendingOption = () => {
    if (!newOption.name.trim()) {
      alert('Please enter a name for the sub-category')
      return
    }
    setPendingOptions((prev) => [...prev, { ...newOption }])
    setNewOption({ name: '', description: '', duration: 60, price: 0 })
  }

  const removePendingOption = (index: number) => {
    setPendingOptions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isOptionsMode && pendingOptions.length === 0) {
      alert('Add at least one sub-category, or disable sub-categories mode.')
      return
    }
    setLoading(true)
    try {
      const payload = isOptionsMode
        ? { name: formData.name, description: formData.description, duration: 0, price: 0 }
        : formData
      const createdService = await masterAPI.createService(payload)

      // Create pending sub-categories for the new service
      if (isOptionsMode && pendingOptions.length > 0) {
        for (const opt of pendingOptions) {
          try {
            await masterAPI.createServiceOption(createdService.id, opt)
          } catch (err: unknown) {
            console.error('Failed to create sub-category:', err)
          }
        }
      }

      onSuccess()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to create service'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: 'white',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Service Name</label>
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
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>
      {!isOptionsMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              required
              min="1"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Price</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              required
              min="0"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      )}

      {/* Sub-categories toggle & inline editor */}
      {!isOptionsMode ? (
        <button
          type="button"
          onClick={() => setIsOptionsMode(true)}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            color: '#9b59b6',
            border: '1px solid #9b59b6',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add sub-categories
        </button>
      ) : (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #e0d4f5', borderRadius: '6px', backgroundColor: '#faf7ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h5 style={{ margin: 0, color: '#9b59b6' }}>Sub-categories</h5>
            {pendingOptions.length === 0 && (
              <button
                type="button"
                onClick={() => setIsOptionsMode(false)}
                style={{ fontSize: '0.8rem', color: '#999', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancel
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
            Each sub-category has its own duration and price.
          </p>

          {/* List of pending options */}
          {pendingOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {pendingOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: '4px', backgroundColor: '#fff', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.85rem' }}>{opt.name} — {opt.duration} min • ${opt.price}</span>
                  <button
                    type="button"
                    onClick={() => removePendingOption(i)}
                    style={{ padding: '0.15rem 0.5rem', backgroundColor: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new option inline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <input
              type="text"
              placeholder="Sub-category name"
              value={newOption.name}
              onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newOption.description}
              onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', minHeight: '40px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Duration (min)</label>
                <input
                  type="number"
                  value={newOption.duration}
                  onChange={(e) => setNewOption({ ...newOption, duration: parseInt(e.target.value) || 0 })}
                  min="1"
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={newOption.price}
                  onChange={(e) => setNewOption({ ...newOption, price: parseFloat(e.target.value) || 0 })}
                  min="0"
                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addPendingOption}
              style={{ padding: '0.4rem', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              + Add Sub-category
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Creating...' : 'Create Service'}
      </button>
    </form>
  )
}

// Editable service card with delete & sub-categories (options) management
function ServiceCard({ service, onChange }: { service: Service; onChange: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hasOptions = (service.options?.length ?? 0) > 0
  const [isOptionsMode, setIsOptionsMode] = useState(hasOptions)
  const [localService, setLocalService] = useState({
    name: service.name,
    description: service.description || '',
    duration: service.duration,
    price: service.price,
  })

  const [options, setOptions] = useState<ServiceOption[]>(service.options || [])
  useEffect(() => {
    setOptions(service.options || [])
    setIsOptionsMode((service.options?.length ?? 0) > 0)
  }, [service.id, service.options])
  const defaultOptionDuration = options[0]?.duration ?? 60
  const defaultOptionPrice = options[0]?.price ?? 0
  const [newOption, setNewOption] = useState({
    name: '',
    description: '',
    duration: defaultOptionDuration,
    price: defaultOptionPrice,
  })
  const [addingOption, setAddingOption] = useState(false)
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null)
  const [editOptionData, setEditOptionData] = useState({ name: '', description: '', duration: 60, price: 0 })
  const [savingOption, setSavingOption] = useState(false)

  const startEditingOption = (opt: ServiceOption) => {
    setEditingOptionId(opt.id)
    setEditOptionData({
      name: opt.name,
      description: opt.description || '',
      duration: opt.duration,
      price: opt.price,
    })
  }

  const handleUpdateOption = async () => {
    if (editingOptionId === null) return
    if (!editOptionData.name.trim()) {
      alert('Please enter a name for the sub-category')
      return
    }
    setSavingOption(true)
    try {
      const updated = await masterAPI.updateServiceOption(editingOptionId, {
        name: editOptionData.name,
        description: editOptionData.description,
        duration: editOptionData.duration,
        price: editOptionData.price,
      })
      setOptions((prev) => prev.map((o) => (o.id === editingOptionId ? { ...o, ...updated } : o)))
      setEditingOptionId(null)
      onChange()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to update sub-category'))
    } finally {
      setSavingOption(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = isOptionsMode
        ? { name: localService.name, description: localService.description, duration: 0, price: 0 }
        : { name: localService.name, description: localService.description, duration: localService.duration, price: localService.price }
      await masterAPI.updateService(service.id, payload)
      setEditing(false)
      onChange()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to update service'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this service? All related appointments and sub-categories will be removed.')) {
      return
    }
    setDeleting(true)
    try {
      await masterAPI.deleteService(service.id)
      onChange()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to delete service'))
    } finally {
      setDeleting(false)
    }
  }

  const handleAddOption = async () => {
    if (!newOption.name.trim()) {
      alert('Please enter a name for the sub-category')
      return
    }
    setAddingOption(true)
    try {
      const created = await masterAPI.createServiceOption(service.id, {
        name: newOption.name,
        description: newOption.description,
        duration: newOption.duration,
        price: newOption.price,
      })
      setOptions((prev) => [...prev, created])
      setNewOption({
        name: '',
        description: '',
        duration: defaultOptionDuration,
        price: defaultOptionPrice,
      })
      onChange()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to add sub-category'))
    } finally {
      setAddingOption(false)
    }
  }

  const handleDeleteOption = async (option: ServiceOption) => {
    if (!confirm(`Delete sub-category "${option.name}"?`)) return
    try {
      await masterAPI.deleteServiceOption(option.id)
      setOptions((prev) => prev.filter((o) => o.id !== option.id))
      onChange()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to delete sub-category'))
    }
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Service main info */}
      {editing ? (
        <>
          <input
            type="text"
            value={localService.name}
            onChange={(e) => setLocalService({ ...localService, name: e.target.value })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '0.5rem',
            }}
          />
          <textarea
            value={localService.description}
            onChange={(e) => setLocalService({ ...localService, description: e.target.value })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '0.5rem',
              minHeight: '60px',
            }}
          />
          {!isOptionsMode && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Duration (minutes)</label>
                <input
                  type="number"
                  value={localService.duration}
                  onChange={(e) => setLocalService({ ...localService, duration: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={localService.price}
                  onChange={(e) => setLocalService({ ...localService, price: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>
          )}
          {isOptionsMode && !hasOptions && (
            <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.5rem' }}>
              Pricing and duration are set per sub-category below.
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setIsOptionsMode(hasOptions)
                setLocalService({
                  name: service.name,
                  description: service.description || '',
                  duration: service.duration,
                  price: service.price,
                })
              }}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <h4 style={{ margin: 0 }}>{service.name}</h4>
          {service.description && <p style={{ margin: '0.25rem 0' }}>{service.description}</p>}
          {hasOptions ? (
            <>
              <span style={{ fontSize: '0.75rem', color: '#9b59b6', fontWeight: 500, marginRight: '0.25rem' }}>Sub-categories</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                {options.map((opt) => (
                  <div key={opt.id} style={{ fontSize: '0.85rem', color: '#555' }}>
                    {opt.name} — {opt.duration} min • ${opt.price}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}>
              Duration: {service.duration} minutes • Price: ${service.price}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={() => setEditing(true)}
              style={{
                flex: 1,
                padding: '0.4rem',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                flex: 1,
                padding: '0.4rem',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </>
      )}

      {/* Sub-categories / options */}
      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #eee',
        }}
      >
        <h5 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '0.95rem' }}>Sub-categories</h5>
        {!hasOptions && !isOptionsMode ? (
          <>
            <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '0.5rem' }}>No sub-categories yet.</p>
            <button
              type="button"
              onClick={() => setIsOptionsMode(true)}
              style={{
                padding: '0.45rem 0.9rem',
                backgroundColor: 'transparent',
                color: '#9b59b6',
                border: '1px solid #9b59b6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Add sub-categories
            </button>
          </>
        ) : options.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#777' }}>Add your first sub-category below.</p>
        ) : null}
        {(hasOptions || isOptionsMode) && options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {options.map((opt) => (
              <div key={opt.id}>
                {editingOptionId === opt.id ? (
                  /* Inline edit form for the sub-category */
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: '4px',
                      backgroundColor: '#f0ecf8',
                      border: '1px solid #d5c8e8',
                    }}
                  >
                    <div style={{ marginBottom: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder="Sub-category name"
                        value={editOptionData.name}
                        onChange={(e) => setEditOptionData({ ...editOptionData, name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          marginBottom: '0.3rem',
                          fontSize: '0.85rem',
                        }}
                      />
                      <textarea
                        placeholder="Description (optional)"
                        value={editOptionData.description}
                        onChange={(e) => setEditOptionData({ ...editOptionData, description: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          minHeight: '40px',
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Duration (min)</label>
                        <input
                          type="number"
                          value={editOptionData.duration}
                          onChange={(e) => setEditOptionData({ ...editOptionData, duration: parseInt(e.target.value) || 0 })}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editOptionData.price}
                          onChange={(e) => setEditOptionData({ ...editOptionData, price: parseFloat(e.target.value) || 0 })}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={handleUpdateOption}
                        disabled={savingOption}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          backgroundColor: '#9b59b6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        {savingOption ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingOptionId(null)}
                        disabled={savingOption}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          backgroundColor: 'transparent',
                          color: '#666',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode for the sub-category */
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: '#f9f9f9',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{opt.name}</div>
                      {opt.description && (
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{opt.description}</div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: '#555' }}>
                        {opt.duration} min • ${opt.price}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => startEditingOption(opt)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          backgroundColor: 'transparent',
                          color: '#9b59b6',
                          border: '1px solid #9b59b6',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOption(opt)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          backgroundColor: 'transparent',
                          color: '#e74c3c',
                          border: '1px solid #e74c3c',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new sub-category - only when sub-categories are enabled */}
        {(hasOptions || isOptionsMode) && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa',
          }}
        >
          <div style={{ marginBottom: '0.4rem' }}>
            <input
              type="text"
              placeholder="Sub-category name"
              value={newOption.name}
              onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
              style={{
                width: '100%',
                padding: '0.4rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.3rem',
                fontSize: '0.85rem',
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newOption.description}
              onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
              style={{
                width: '100%',
                padding: '0.4rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.3rem',
                fontSize: '0.85rem',
                minHeight: '50px',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Duration (min)</label>
              <input
                type="number"
                value={newOption.duration}
                onChange={(e) => setNewOption({ ...newOption, duration: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Price</label>
              <input
                type="number"
                step="0.01"
                value={newOption.price}
                onChange={(e) => setNewOption({ ...newOption, price: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>
          <button
            onClick={handleAddOption}
            disabled={addingOption}
            style={{
              width: '100%',
              padding: '0.45rem',
              backgroundColor: '#9b59b6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {addingOption ? 'Adding...' : 'Add Sub-category'}
          </button>
        </div>
        )}
      </div>
    </div>
  )
}

function AppointmentRequestCard({ appointment, onUpdate }: { appointment: Appointment; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await masterAPI.confirmAppointment(appointment.id)
      onUpdate()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to confirm appointment'))
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    try {
      await masterAPI.rejectAppointment(appointment.id)
      onUpdate()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to reject appointment'))
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
          <p>Client: {appointment.user?.name}</p>
          <p>Email: {appointment.user?.email}</p>
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

// Fixed 8 AM - 10 PM day grid with 1-hour slots, color-coded by availability
type HourSlotStatus = 'available' | 'booked' | 'pending' | 'confirmed'

type HourSlotDisplay = {
  hour: number
  startTime: string
  endTime: string
  status: HourSlotStatus
  label: string
  appointment?: Appointment
  timeSlot?: TimeSlot & { service?: Service }
  service?: Service
}

function MasterCalendar({ 
  services, 
  appointments, 
  onUpdate 
}: { 
  services: Service[]
  appointments: Appointment[]
  onUpdate: () => void
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [hourSlots, setHourSlots] = useState<HourSlotDisplay[]>([])
  const [loading, setLoading] = useState(false)
  const [bookModalSlot, setBookModalSlot] = useState<HourSlotDisplay | null>(null)
  const [bookModalStep, setBookModalStep] = useState<'choice' | 'work'>('choice')
  const [workClientSearch, setWorkClientSearch] = useState('')
  const [workSelectedClient, setWorkSelectedClient] = useState<User | null>(null)
  const [workSelectedService, setWorkSelectedService] = useState<Service | null>(null)
  const [workSelectedOption, setWorkSelectedOption] = useState<ServiceOption | null>(null)
  const [workSearchResults, setWorkSearchResults] = useState<User[]>([])
  const [workSearchLoading, setWorkSearchLoading] = useState(false)
  const [bookSubmitting, setBookSubmitting] = useState(false)

  const debouncedClientSearch = useDebounce(workClientSearch, 300)

  useEffect(() => {
    if (debouncedClientSearch.length >= 2) {
      setWorkSearchLoading(true)
      masterAPI.searchUsers(debouncedClientSearch)
        .then(setWorkSearchResults)
        .catch(() => setWorkSearchResults([]))
        .finally(() => setWorkSearchLoading(false))
    } else {
      setWorkSearchResults([])
    }
  }, [debouncedClientSearch])

  const fetchDaySchedule = useCallback(async () => {
    if (!selectedDate) return
    
    setLoading(true)
    try {
      const dayStart = new Date(selectedDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(selectedDate)
      dayEnd.setHours(23, 59, 59, 999)
      
      const dbSlots = await masterAPI.getTimeSlots({
        start_date: dayStart.toISOString(),
        end_date: dayEnd.toISOString(),
      })
      
      const dayAppointments = appointments.filter(apt => {
        const aptStart = new Date(apt.start_time)
        return aptStart >= dayStart && aptStart <= dayEnd &&
          apt.status !== 'rejected' && apt.status !== 'cancelled'
      })
      
      // Generate fixed 1-hour slots from 8 AM to 10 PM (14 slots)
      const slots: HourSlotDisplay[] = []
      for (let hour = 8; hour <= 21; hour++) {
        const slotStart = new Date(selectedDate)
        slotStart.setHours(hour, 0, 0, 0)
        const slotEnd = new Date(selectedDate)
        slotEnd.setHours(hour + 1, 0, 0, 0)
        const slotStartMs = slotStart.getTime()
        const slotEndMs = slotEnd.getTime()
        
        const overlaps = (start: string | Date, end: string | Date) => {
          const s = typeof start === 'string' ? new Date(start).getTime() : start.getTime()
          const e = typeof end === 'string' ? new Date(end).getTime() : end.getTime()
          return s < slotEndMs && e > slotStartMs
        }
        
        // Find overlapping appointment (confirmed takes precedence over pending)
        const overlappingApts = dayAppointments.filter(a => overlaps(a.start_time, a.end_time))
        const overlappingApt = overlappingApts.find(a => a.status === 'confirmed') ?? overlappingApts[0]
        
        // Find overlapping DB time slot
        const overlappingDbSlot = dbSlots.find((s: TimeSlot) => 
          overlaps(s.start_time, s.end_time)
        ) as (TimeSlot & { service?: Service }) | undefined
        
        let status: HourSlotStatus = 'available'
        let label = 'Available'
        
        if (overlappingApt) {
          if (overlappingApt.status === 'confirmed') {
            status = 'confirmed'
            label = `${overlappingApt.user?.name || 'Client'} - ${overlappingApt.service?.name || 'Service'}`
          } else {
            status = 'pending'
            label = `${overlappingApt.user?.name || 'Client'} - ${overlappingApt.service?.name || 'Service'}`
          }
        } else if (overlappingDbSlot?.is_booked) {
          status = 'booked'
          label = 'Booked'
        } else {
          status = 'available'
          label = 'Available'
        }
        
        slots.push({
          hour,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          status,
          label,
          appointment: overlappingApt,
          timeSlot: overlappingDbSlot,
          service: overlappingDbSlot?.service ?? overlappingApt?.service ?? services[0],
        })
      }
      
      setHourSlots(slots)
    } catch (error) {
      console.error('Failed to fetch schedule:', error)
      setHourSlots([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate, appointments, services])

  useEffect(() => {
    if (selectedDate) {
      fetchDaySchedule()
    }
  }, [selectedDate, fetchDaySchedule])

  const handleToggleSlot = async (slot: HourSlotDisplay) => {
    if (slot.status === 'confirmed' || slot.status === 'pending') return
    const service = slot.service ?? services[0]
    if (!service) return

    const newBooked = slot.status === 'available'
    try {
      await masterAPI.toggleTimeSlotBooking({
        timeSlotId: slot.timeSlot?.id,
        service_id: service.id,
        start_time: slot.startTime,
        end_time: slot.endTime,
        is_booked: newBooked,
      })
      fetchDaySchedule()
      onUpdate()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to update slot'))
    }
  }

  const handleCancelSlot = async (e: React.MouseEvent, slot: HourSlotDisplay) => {
    e.stopPropagation()
    if (slot.status !== 'booked') return
    await handleToggleSlot(slot)
  }

  const handleCancelAppointment = async (e: React.MouseEvent, slot: HourSlotDisplay) => {
    e.stopPropagation()
    if (!slot.appointment || (slot.status !== 'confirmed' && slot.status !== 'pending')) return
    try {
      await masterAPI.rejectAppointment(slot.appointment.id)
      fetchDaySchedule()
      onUpdate()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to cancel appointment'))
    }
  }

  const closeBookModal = () => {
    setBookModalSlot(null)
    setBookModalStep('choice')
    setWorkClientSearch('')
    setWorkSelectedClient(null)
    setWorkSelectedService(null)
    setWorkSelectedOption(null)
    setWorkSearchResults([])
  }

  const handleBookForMyself = async () => {
    if (!bookModalSlot) return
    const service = bookModalSlot.service ?? services[0]
    if (!service) return
    setBookSubmitting(true)
    try {
      await masterAPI.toggleTimeSlotBooking({
        timeSlotId: bookModalSlot.timeSlot?.id,
        service_id: service.id,
        start_time: bookModalSlot.startTime,
        end_time: bookModalSlot.endTime,
        is_booked: true,
      })
      fetchDaySchedule()
      onUpdate()
      closeBookModal()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to book slot'))
    } finally {
      setBookSubmitting(false)
    }
  }

  const handleBookWork = async () => {
    if (!bookModalSlot || !workSelectedClient || !workSelectedService) return
    const hasOptions = workSelectedService.options && workSelectedService.options.length > 0
    if (hasOptions && !workSelectedOption) return
    setBookSubmitting(true)
    try {
      await masterAPI.createAppointmentForClient({
        user_id: workSelectedClient.id,
        service_id: workSelectedService.id,
        service_option_id: workSelectedOption?.id,
        start_time: bookModalSlot.startTime,
      })
      fetchDaySchedule()
      onUpdate()
      closeBookModal()
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, 'Failed to create appointment'))
    } finally {
      setBookSubmitting(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatHour = (hour: number) => {
    const h = hour % 12 || 12
    const ampm = hour < 12 ? 'AM' : 'PM'
    return `${h}:00 ${ampm}`
  }

  const statusColors: Record<HourSlotStatus, { bg: string; border: string }> = {
    available: { bg: '#e8f5e9', border: '#4caf50' },
    booked: { bg: '#eceff1', border: '#78909c' },
    pending: { bg: '#fff3e0', border: '#f39c12' },
    confirmed: { bg: '#ffebee', border: '#e74c3c' },
  }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '1rem',
      backgroundColor: 'white',
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Select Date</h4>
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={(date) => setSelectedDate(date)}
        />
      </div>

      {selectedDate && (
        <div>
          <h4 style={{ marginBottom: '0.5rem' }}>
            Schedule for {formatDate(selectedDate)} — 8 AM to 10 PM
          </h4>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>Loading...</div>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
                <span style={{ marginRight: '1rem' }}><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 2 }} /> Available</span>
                <span style={{ marginRight: '1rem' }}><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#eceff1', border: '1px solid #78909c', borderRadius: 2 }} /> Booked</span>
                <span style={{ marginRight: '1rem' }}><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#fff3e0', border: '1px solid #f39c12', borderRadius: 2 }} /> Pending</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#ffebee', border: '1px solid #e74c3c', borderRadius: 2 }} /> Confirmed</span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
              }}>
                {hourSlots.map((slot, index) => {
                  const colors = statusColors[slot.status]
                  const isBooked = slot.status === 'booked'
                  const isAppointment = slot.status === 'confirmed' || slot.status === 'pending'
                  const isAvailable = slot.status === 'available'
                  const canBook = isAvailable && services.length > 0
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: colors.bg,
                        border: `2px solid ${colors.border}`,
                        borderRadius: '4px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {formatHour(slot.hour)} – {formatHour(slot.hour + 1)}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#333', marginTop: '0.25rem' }}>
                          {slot.label}
                        </div>
                      </div>
                      {isBooked && (
                        <button
                          type="button"
                          onClick={(e) => handleCancelSlot(e, slot)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.8rem',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            alignSelf: 'flex-start',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      {isAppointment && (
                        <button
                          type="button"
                          onClick={(e) => handleCancelAppointment(e, slot)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.8rem',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            alignSelf: 'flex-start',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      {canBook && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setBookModalSlot(slot)
                            setBookModalStep('choice')
                          }}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.8rem',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            alignSelf: 'flex-start',
                          }}
                        >
                          Book
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {bookModalSlot && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                  onClick={closeBookModal}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: 'white',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      minWidth: 320,
                      maxWidth: 400,
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0 }}>Book slot</h4>
                      <button
                        type="button"
                        onClick={closeBookModal}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '1.5rem',
                          cursor: 'pointer',
                          color: '#666',
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                    {bookModalStep === 'choice' ? (
                      <>
                        <p style={{ marginBottom: '1rem', color: '#666' }}>
                          {formatHour(bookModalSlot.hour)} – {formatHour(bookModalSlot.hour + 1)}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={handleBookForMyself}
                            disabled={bookSubmitting}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: '#3498db',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: bookSubmitting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            For myself
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookModalStep('work')}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: '#2ecc71',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Work
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
                          Book for client — {formatHour(bookModalSlot.hour)} – {formatHour(bookModalSlot.hour + 1)}
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Client</label>
                          <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={workClientSearch}
                            onChange={(e) => setWorkClientSearch(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.25rem' }}
                          />
                          {workSearchLoading && <div style={{ fontSize: '0.8rem', color: '#666' }}>Searching...</div>}
                          {workSearchResults.length > 0 && (
                            <div style={{ marginTop: '0.25rem', maxHeight: 120, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                              {workSearchResults.map((u) => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setWorkSelectedClient(u)
                                    setWorkClientSearch(u.name)
                                    setWorkSearchResults([])
                                  }}
                                  style={{
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    backgroundColor: workSelectedClient?.id === u.id ? '#e8f5e9' : 'white',
                                  }}
                                >
                                  {u.name} <span style={{ color: '#666', fontSize: '0.85rem' }}>({u.email})</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {debouncedClientSearch.length >= 2 && !workSearchLoading && workSearchResults.length === 0 && (
                            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                              No clients found. Ask them to register first.
                            </div>
                          )}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Service</label>
                          <select
                            value={workSelectedService?.id ?? ''}
                            onChange={(e) => {
                              const id = Number(e.target.value)
                              const s = services.find((sv) => sv.id === id) ?? null
                              setWorkSelectedService(s)
                              setWorkSelectedOption(null)
                            }}
                            style={{ width: '100%', padding: '0.5rem' }}
                          >
                            <option value="">Select service</option>
                            {services.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        {workSelectedService?.options && workSelectedService.options.length > 0 && (
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Sub-category</label>
                            <select
                              value={workSelectedOption?.id ?? ''}
                              onChange={(e) => {
                                const id = Number(e.target.value)
                                setWorkSelectedOption(workSelectedService.options?.find((o) => o.id === id) ?? null)
                              }}
                              style={{ width: '100%', padding: '0.5rem' }}
                            >
                              <option value="">Select sub-category</option>
                              {workSelectedService.options.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setBookModalStep('choice')}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#ddd',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={handleBookWork}
                            disabled={
                              bookSubmitting ||
                              !workSelectedClient ||
                              !workSelectedService ||
                              (!!workSelectedService?.options?.length && !workSelectedOption)
                            }
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#2ecc71',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor:
                                bookSubmitting ||
                                !workSelectedClient ||
                                !workSelectedService ||
                                (!!workSelectedService?.options?.length && !workSelectedOption)
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            {bookSubmitting ? 'Booking...' : 'Confirm'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
