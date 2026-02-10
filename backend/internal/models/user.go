package models

import (
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	RoleUser   UserRole = "user"
	RoleMaster UserRole = "master"
	RoleAdmin  UserRole = "admin"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Email    string   `gorm:"uniqueIndex;not null" json:"email"`
	Password string   `gorm:"not null" json:"-"`
	Name     string   `gorm:"not null" json:"name"`
	Role     UserRole `gorm:"type:varchar(20);not null;default:'user'" json:"role"`
	Phone    string   `json:"phone"`

	// Master-specific fields
	MasterProfile *MasterProfile `gorm:"foreignKey:UserID" json:"master_profile,omitempty"`

	// Relations
	Appointments []Appointment `gorm:"foreignKey:UserID" json:"appointments,omitempty"`
}

type MasterProfile struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UserID     uint   `gorm:"uniqueIndex;not null" json:"user_id"`
	User       User   `gorm:"foreignKey:UserID" json:"user"`
	Bio        string `gorm:"type:text" json:"bio"`
	Specialty  string `json:"specialty"`
	Experience int    `json:"experience"` // years of experience

	// Relations
	Services     []Service     `gorm:"foreignKey:MasterID" json:"services,omitempty"`
	Appointments []Appointment `gorm:"foreignKey:MasterID" json:"appointments,omitempty"`
}
