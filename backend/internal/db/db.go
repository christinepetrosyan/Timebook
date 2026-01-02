package db

import (
	"fmt"
	"log"

	"github.com/timebook/backend/internal/config"
	"github.com/timebook/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Initialize(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		cfg.DBHost,
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBName,
		cfg.DBPort,
		cfg.DBSSLMode,
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connection established")

	// Note: We're not using AutoMigrate as per requirements
	// Migrations are handled by go-migrate

	return DB, nil
}

func GetDB() *gorm.DB {
	return DB
}

// Helper function to check if tables exist (for health checks)
func CheckTables() error {
	var count int64
	if err := DB.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	return nil
}

