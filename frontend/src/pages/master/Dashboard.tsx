import { useState, useEffect } from 'react'
import { masterAPI, getApiErrorMessage } from '../../services/api'
import type { Service, Appointment, TimeSlot, ServiceOption } from '../../types'

export default function MasterDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  return (
    <div>
      <h2>Master Dashboard</h2>
      {loadError && (
        <div style={{ padding: '1rem', marginBottom: '1rem', background: '#fee', color: '#c00', borderRadius: '4px' }}>
          {loadError}
        </div>
      )}
      <div style={{ marginBottom: '2rem' }}>
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
      
      <div style={{ marginBottom: '2rem' }}>
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
      
      <div>
        <h3>Appointment Requests</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map((appointment) => (
            <AppointmentRequestCard key={appointment.id} appointment={appointment} onUpdate={loadData} />
          ))}
        </div>
      </div>
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
          } catch (err: any) {
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
  }, [service.id, service.options?.length])
  const defaultOptionDuration = options[0]?.duration ?? 60
  const defaultOptionPrice = options[0]?.price ?? 0
  const [newOption, setNewOption] = useState({
    name: '',
    description: '',
    duration: defaultOptionDuration,
    price: defaultOptionPrice,
  })
  const [addingOption, setAddingOption] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = isOptionsMode
        ? { name: localService.name, description: localService.description, duration: 0, price: 0 }
        : { name: localService.name, description: localService.description, duration: localService.duration, price: localService.price }
      await masterAPI.updateService(service.id, payload)
      setEditing(false)
      onChange()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update service')
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
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete service')
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
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add sub-category')
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
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete sub-category')
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
              <div
                key={opt.id}
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

export function _TimeSlotForm({
  services,
  selectedServiceId,
  onSuccess,
}: {
  services: Service[]
  selectedServiceId: number | null
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    service_id: selectedServiceId || (services.length > 0 ? services[0].id : 0),
    start_time: '',
    end_time: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedServiceId) {
      setFormData({ ...formData, service_id: selectedServiceId })
    }
  }, [selectedServiceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.service_id) {
      alert('Please select a service')
      return
    }
    setLoading(true)
    try {
      await masterAPI.createTimeSlot({
        service_id: formData.service_id,
        start_time: formData.start_time,
        end_time: formData.end_time,
      })
      onSuccess()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create time slot')
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
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Service</label>
        <select
          value={formData.service_id}
          onChange={(e) => setFormData({ ...formData, service_id: parseInt(e.target.value) })}
          required
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        >
          <option value="">Select a service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.options && service.options.length > 0
                ? `${service.name} (sub-categories)`
                : `${service.name} (${service.duration} min)`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Start Time</label>
          <input
            type="datetime-local"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>End Time</label>
          <input
            type="datetime-local"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !formData.service_id}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#9b59b6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Creating...' : 'Create Time Slot'}
      </button>
    </form>
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

export function _TimeSlotCard({ timeSlot, onUpdate }: { timeSlot: TimeSlot; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    start_time: timeSlot.start_time.slice(0, 16),
    end_time: timeSlot.end_time.slice(0, 16),
  })

  const handleDelete = async () => {
    if (!timeSlot.id) return
    if (!confirm('Are you sure you want to delete this time slot?')) return
    
    setLoading(true)
    try {
      await masterAPI.deleteTimeSlot(timeSlot.id)
      onUpdate()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete time slot')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!timeSlot.id) return
    
    setLoading(true)
    try {
      await masterAPI.updateTimeSlot(timeSlot.id, {
        start_time: editData.start_time,
        end_time: editData.end_time,
      })
      setIsEditing(false)
      onUpdate()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update time slot')
    } finally {
      setLoading(false)
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
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1 }}>
        <h4>{timeSlot.service?.name || 'Unknown Service'}</h4>
        {isEditing ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            <input
              type="datetime-local"
              value={editData.start_time}
              onChange={(e) => setEditData({ ...editData, start_time: e.target.value })}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <input
              type="datetime-local"
              value={editData.end_time}
              onChange={(e) => setEditData({ ...editData, end_time: e.target.value })}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
        ) : (
          <>
            <p>
              {new Date(timeSlot.start_time).toLocaleString()} - {new Date(timeSlot.end_time).toLocaleString()}
            </p>
            <p style={{ color: timeSlot.is_booked ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>
              {timeSlot.is_booked ? 'Booked' : 'Available'}
            </p>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {isEditing ? (
          <>
            <button
              onClick={handleUpdate}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditData({
                  start_time: timeSlot.start_time.slice(0, 16),
                  end_time: timeSlot.end_time.slice(0, 16),
                })
              }}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {!timeSlot.is_booked && (
              <button
                onClick={() => setIsEditing(true)}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            )}
            {!timeSlot.is_booked && (
              <button
                onClick={handleDelete}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Unified calendar component showing all services and appointments
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
  const [allSlots, setAllSlots] = useState<Array<TimeSlot & { service?: Service; appointment?: Appointment }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedDate && services.length > 0) {
      fetchAllSlots()
    }
  }, [selectedDate, services])

  const fetchAllSlots = async () => {
    if (!selectedDate || services.length === 0) return
    
    setLoading(true)
    try {
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      // Fetch slots from all services
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api')
      const token = localStorage.getItem('token')
      
      const slotPromises = services.map(async (service) => {
        try {
          const response = await fetch(
            `${apiUrl}/services/${service.id}/slots?start_date=${startOfDay.toISOString()}&end_date=${endOfDay.toISOString()}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          )
          const slots = await response.json()
          return slots.map((slot: TimeSlot) => ({
            ...slot,
            service,
          }))
        } catch (error) {
          console.error(`Failed to fetch slots for service ${service.id}:`, error)
          return []
        }
      })
      
      const allServiceSlots = await Promise.all(slotPromises)
      const flattenedSlots = allServiceSlots.flat()
      
      // Filter and merge with appointments
      const daySlots = flattenedSlots
        .filter((slot: TimeSlot) => {
          const slotDate = new Date(slot.start_time)
          return slotDate >= startOfDay && slotDate <= endOfDay
        })
        .map((slot: TimeSlot & { service?: Service }) => {
          // Find matching appointment
          const matchingAppointment = appointments.find(apt => 
            apt.service_id === slot.service_id &&
            new Date(apt.start_time).getTime() === new Date(slot.start_time).getTime() &&
            new Date(apt.end_time).getTime() === new Date(slot.end_time).getTime()
          )
          
          return {
            ...slot,
            appointment: matchingAppointment,
            // Mark as booked if there's a confirmed appointment or slot is booked
            is_booked: Boolean(slot.is_booked || (matchingAppointment && matchingAppointment.status === 'confirmed')),
          }
        })
        .sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      
      setAllSlots(daySlots)
    } catch (error) {
      console.error('Failed to fetch slots:', error)
      setAllSlots([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSlot = async (slot: TimeSlot & { service?: Service }) => {
    if (!slot.service) return
    
    try {
      await masterAPI.toggleTimeSlotBooking({
        timeSlotId: slot.id,
        service_id: slot.service.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_booked: !slot.is_booked,
      })
      // Immediately update local state
      setAllSlots(prevSlots => 
        prevSlots.map(s => 
          s.start_time === slot.start_time && s.service_id === slot.service_id
            ? { ...s, is_booked: !s.is_booked, available: s.is_booked }
            : s
        )
      )
      // Also refresh from server
      fetchAllSlots()
      onUpdate() // Refresh appointments
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update slot')
    }
  }

  const generateCalendarDays = () => {
    const days: Date[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      days.push(date)
    }
    
    return days
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '1rem',
      backgroundColor: 'white',
    }}>
      {/* Calendar */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Select Date</h4>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: '0.5rem',
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '0.5rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
        }}>
          {generateCalendarDays().map((date, index) => (
            <button
              key={index}
              onClick={() => setSelectedDate(date)}
              style={{
                padding: '0.5rem',
                border: selectedDate?.toDateString() === date.toDateString() 
                  ? '2px solid #3498db' 
                  : '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: selectedDate?.toDateString() === date.toDateString()
                  ? '#e3f2fd'
                  : isToday(date)
                  ? '#fff9c4'
                  : 'white',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: isToday(date) ? 'bold' : 'normal',
              }}
            >
              <div>{date.getDate()}</div>
              <div style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div>
          <h4 style={{ marginBottom: '0.5rem' }}>
            Schedule for {formatDate(selectedDate)}
          </h4>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
              Loading schedule...
            </div>
          ) : (
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '0.5rem',
            }}>
              {allSlots.map((slot, index) => {
                const isBooked = slot.is_booked || slot.available === false
                const hasAppointment = slot.appointment && slot.appointment.status !== 'rejected'
                
                return (
                  <div
                    key={index}
                    onClick={() => !hasAppointment && handleToggleSlot(slot)}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: isBooked ? '#ffebee' : '#e8f5e9',
                      border: hasAppointment ? '2px solid #f39c12' : '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: hasAppointment ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                          {slot.service?.name || 'Unknown Service'}
                        </div>
                        {hasAppointment && (
                          <div style={{ fontSize: '0.85rem', color: '#f39c12', marginTop: '0.25rem', fontWeight: 'bold' }}>
                            Appointment: {slot.appointment?.user?.name} ({slot.appointment?.status})
                          </div>
                        )}
                        {!hasAppointment && (
                          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                            {isBooked ? 'Booked (Click to mark available)' : 'Available (Click to mark booked)'}
                          </div>
                        )}
                      </div>
                      <span style={{ 
                        color: isBooked ? '#e74c3c' : '#27ae60', 
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        marginLeft: '1rem',
                      }}>
                        {hasAppointment ? '📅' : (isBooked ? '✕' : '✓')}
                      </span>
                    </div>
                  </div>
                )
              })}
              {allSlots.length === 0 && (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                  No slots or appointments for this date
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
