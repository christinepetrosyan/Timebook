package repositories

import (
	"context"

	"github.com/timebook/backend/internal/models"
	"gorm.io/gorm"
)

// AppointmentRepository defines the interface for appointment data access
type AppointmentRepository interface {
	GetByID(ctx context.Context, tx *gorm.DB, id uint) (*models.Appointment, error)
	Create(ctx context.Context, tx *gorm.DB, appointment *models.Appointment) error
	Update(ctx context.Context, tx *gorm.DB, appointment *models.Appointment) error
	List(ctx context.Context, tx *gorm.DB, filters map[string]interface{}) ([]*models.Appointment, error)
}

type appointmentRepo struct {
	db *gorm.DB
}

// NewAppointmentRepository creates a new appointment repository
func NewAppointmentRepository(db *gorm.DB) AppointmentRepository {
	return &appointmentRepo{db: db}
}

// GetByID retrieves an appointment by ID
func (r *appointmentRepo) GetByID(ctx context.Context, tx *gorm.DB, id uint) (*models.Appointment, error) {
	var appointment models.Appointment
	db := r.getDB(tx)
	err := db.WithContext(ctx).Preload("User").Preload("Service").Preload("Master").First(&appointment, id).Error
	return &appointment, err
}

// Create creates a new appointment
func (r *appointmentRepo) Create(ctx context.Context, tx *gorm.DB, appointment *models.Appointment) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Create(appointment).Error
}

// Update updates an existing appointment
func (r *appointmentRepo) Update(ctx context.Context, tx *gorm.DB, appointment *models.Appointment) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Save(appointment).Error
}

// List retrieves appointments based on filters
func (r *appointmentRepo) List(ctx context.Context, tx *gorm.DB, filters map[string]interface{}) ([]*models.Appointment, error) {
	var appointments []*models.Appointment
	db := r.getDB(tx).WithContext(ctx)

	for key, value := range filters {
		db = db.Where(key+" = ?", value)
	}

	err := db.Preload("User").Preload("Service").Preload("Master").Find(&appointments).Error
	return appointments, err
}

// getDB returns the transaction if provided, otherwise returns the default DB
func (r *appointmentRepo) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}
