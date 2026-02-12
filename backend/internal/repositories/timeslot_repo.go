package repositories

import (
	"context"

	"github.com/timebook/backend/internal/models"
	"gorm.io/gorm"
)

// TimeslotRepository defines the interface for timeslot data access
type TimeslotRepository interface {
	GetByID(ctx context.Context, tx *gorm.DB, id uint) (*models.TimeSlot, error)
	Create(ctx context.Context, tx *gorm.DB, slot *models.TimeSlot) error
	Update(ctx context.Context, tx *gorm.DB, slot *models.TimeSlot) error
	BookAllSlotsAtTime(ctx context.Context, tx *gorm.DB, masterID uint, startTime, endTime interface{}) error
	EnsureSlotExists(ctx context.Context, tx *gorm.DB, appointment *models.Appointment) error
}

type timeslotRepo struct {
	db *gorm.DB
}

// NewTimeslotRepository creates a new timeslot repository
func NewTimeslotRepository(db *gorm.DB) TimeslotRepository {
	return &timeslotRepo{db: db}
}

// GetByID retrieves a timeslot by ID
func (r *timeslotRepo) GetByID(ctx context.Context, tx *gorm.DB, id uint) (*models.TimeSlot, error) {
	var slot models.TimeSlot
	db := r.getDB(tx)
	err := db.WithContext(ctx).First(&slot, id).Error
	return &slot, err
}

// Create creates a new timeslot
func (r *timeslotRepo) Create(ctx context.Context, tx *gorm.DB, slot *models.TimeSlot) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Create(slot).Error
}

// Update updates an existing timeslot
func (r *timeslotRepo) Update(ctx context.Context, tx *gorm.DB, slot *models.TimeSlot) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Save(slot).Error
}

// BookAllSlotsAtTime marks all time slots at a specific time as booked
func (r *timeslotRepo) BookAllSlotsAtTime(ctx context.Context, tx *gorm.DB, masterID uint, startTime, endTime interface{}) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Model(&models.TimeSlot{}).Where(
		"master_id = ? AND start_time = ? AND end_time = ?",
		masterID, startTime, endTime,
	).Update("is_booked", true).Error
}

// EnsureSlotExists creates a time slot if it doesn't exist
func (r *timeslotRepo) EnsureSlotExists(ctx context.Context, tx *gorm.DB, appointment *models.Appointment) error {
	var existingSlot models.TimeSlot
	db := r.getDB(tx)

	err := db.WithContext(ctx).Where(
		"master_id = ? AND service_id = ? AND start_time = ? AND end_time = ?",
		appointment.MasterID,
		appointment.ServiceID,
		appointment.StartTime,
		appointment.EndTime,
	).First(&existingSlot).Error

	if err == gorm.ErrRecordNotFound {
		// Slot doesn't exist, create it
		newSlot := &models.TimeSlot{
			MasterID:  appointment.MasterID,
			ServiceID: appointment.ServiceID,
			StartTime: appointment.StartTime,
			EndTime:   appointment.EndTime,
			IsBooked:  true,
		}
		return r.Create(ctx, tx, newSlot)
	}

	return err
}

// getDB returns the transaction if provided, otherwise returns the default DB
func (r *timeslotRepo) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}
