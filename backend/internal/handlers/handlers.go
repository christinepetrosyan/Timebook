package handlers

import (
	"github.com/timebook/backend/internal/config"
	"gorm.io/gorm"
)

type Handlers struct {
	DB     *gorm.DB
	Config *config.Config
}

func New(db *gorm.DB, cfg *config.Config) *Handlers {
	return &Handlers{
		DB:     db,
		Config: cfg,
	}
}

