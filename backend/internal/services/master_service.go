package services

import (
	"context"

	"github.com/timebook/backend/internal/models"
	"github.com/timebook/backend/internal/repositories"
	"github.com/timebook/backend/internal/transaction"
	"gorm.io/gorm"
)

// MasterService handles business logic for master operations
type MasterService struct {
	masterRepo repositories.MasterRepository
	txManager  *transaction.Manager
}

// NewMasterService creates a new master service
func NewMasterService(masterRepo repositories.MasterRepository, txManager *transaction.Manager) *MasterService {
	return &MasterService{
		masterRepo: masterRepo,
		txManager:  txManager,
	}
}

// GetOrCreateMasterProfile retrieves or creates a master profile
func (s *MasterService) GetOrCreateMasterProfile(ctx context.Context, userID uint) (*models.MasterProfile, error) {
	profile, err := s.masterRepo.GetByUserID(ctx, nil, userID)
	if err == gorm.ErrRecordNotFound {
		// Profile doesn't exist, create it
		profile = &models.MasterProfile{UserID: userID}
		if err := s.masterRepo.Create(ctx, nil, profile); err != nil {
			return nil, err
		}
		return profile, nil
	}
	return profile, err
}
