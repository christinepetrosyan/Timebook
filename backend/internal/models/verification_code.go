package models

import (
	"time"
)

type VerificationCode struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Email     string    `gorm:"type:varchar(255);not null" json:"email"`
	Code      string    `gorm:"type:varchar(6);not null" json:"-"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
}
