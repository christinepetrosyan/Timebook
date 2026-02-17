package models

import (
	"time"

	"gorm.io/gorm"
)

type AppointmentStatus string

const (
	StatusPending   AppointmentStatus = "pending"
	StatusConfirmed AppointmentStatus = "confirmed"
	StatusRejected  AppointmentStatus = "rejected"
	StatusCancelled AppointmentStatus = "cancelled"
)

type Appointment struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID          uint              `gorm:"not null" json:"user_id"`
	MasterID        uint              `gorm:"not null" json:"master_id"`
	ServiceID       uint              `gorm:"not null" json:"service_id"`
	ServiceOptionID *uint             `json:"service_option_id,omitempty"`
	StartTime       time.Time         `gorm:"not null" json:"start_time"`
	EndTime         time.Time         `gorm:"not null" json:"end_time"`
	Status          AppointmentStatus `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	Notes           string            `gorm:"type:text" json:"notes"`

	// Relations
	User          User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Master        MasterProfile  `gorm:"foreignKey:MasterID" json:"master,omitempty"`
	Service       Service        `gorm:"foreignKey:ServiceID" json:"service,omitempty"`
	ServiceOption *ServiceOption `gorm:"foreignKey:ServiceOptionID" json:"service_option,omitempty"`
}
