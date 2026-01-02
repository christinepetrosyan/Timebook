package models

import (
	"time"

	"gorm.io/gorm"
)

type Service struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	MasterID    uint   `gorm:"not null" json:"master_id"`
	Name        string `gorm:"not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	Duration    int    `gorm:"not null" json:"duration"` // duration in minutes
	Price       float64 `gorm:"not null" json:"price"`

	// Relations
	Master      MasterProfile `gorm:"foreignKey:MasterID" json:"master,omitempty"`
	Appointments []Appointment `gorm:"foreignKey:ServiceID" json:"appointments,omitempty"`
}

type TimeSlot struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	MasterID  uint      `gorm:"not null" json:"master_id"`
	ServiceID uint      `gorm:"not null" json:"service_id"`
	StartTime time.Time `gorm:"not null" json:"start_time"`
	EndTime   time.Time `gorm:"not null" json:"end_time"`
	IsBooked  bool      `gorm:"default:false" json:"is_booked"`

	// Relations
	Master  MasterProfile `gorm:"foreignKey:MasterID" json:"master,omitempty"`
	Service Service       `gorm:"foreignKey:ServiceID" json:"service,omitempty"`
}

