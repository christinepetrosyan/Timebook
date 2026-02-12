package transaction

import (
	"context"

	"gorm.io/gorm"
)

// Manager handles database transactions
type Manager struct {
	db *gorm.DB
}

// New creates a new transaction manager
func New(db *gorm.DB) *Manager {
	return &Manager{db: db}
}

// WithTransaction executes a function within a database transaction
// If the function returns an error, the transaction is rolled back
// Otherwise, the transaction is committed
func (m *Manager) WithTransaction(ctx context.Context, fn func(tx *gorm.DB) (interface{}, error)) (interface{}, error) {
	tx := m.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	result, err := fn(tx)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	return result, nil
}
