package repositories

import (
	"context"

	"github.com/timebook/backend/internal/models"
	"gorm.io/gorm"
)

// MasterRepository defines the interface for master profile data access
type MasterRepository interface {
	GetByUserID(ctx context.Context, tx *gorm.DB, userID uint) (*models.MasterProfile, error)
	Create(ctx context.Context, tx *gorm.DB, profile *models.MasterProfile) error
	Update(ctx context.Context, tx *gorm.DB, profile *models.MasterProfile) error
}

type masterRepo struct {
	db *gorm.DB
}

// NewMasterRepository creates a new master repository
func NewMasterRepository(db *gorm.DB) MasterRepository {
	return &masterRepo{db: db}
}

// GetByUserID retrieves a master profile by user ID
func (r *masterRepo) GetByUserID(ctx context.Context, tx *gorm.DB, userID uint) (*models.MasterProfile, error) {
	var profile models.MasterProfile
	db := r.getDB(tx)
	err := db.WithContext(ctx).Where("user_id = ?", userID).First(&profile).Error
	return &profile, err
}

// Create creates a new master profile
func (r *masterRepo) Create(ctx context.Context, tx *gorm.DB, profile *models.MasterProfile) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Create(profile).Error
}

// Update updates an existing master profile
func (r *masterRepo) Update(ctx context.Context, tx *gorm.DB, profile *models.MasterProfile) error {
	db := r.getDB(tx)
	return db.WithContext(ctx).Save(profile).Error
}

// getDB returns the transaction if provided, otherwise returns the default DB
func (r *masterRepo) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}
