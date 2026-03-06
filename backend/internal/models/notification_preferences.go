package models

import (
	"time"

	"gorm.io/gorm"
)

type NotificationPreferences struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	UserID          uint           `gorm:"uniqueIndex;not null" json:"user_id"`
	EmailEnabled    bool           `gorm:"not null;default:true" json:"email_enabled"`
	WhatsAppEnabled bool           `gorm:"not null;default:false" json:"whatsapp_enabled"`
	WhatsAppPhone   string         `json:"whatsapp_phone"`
	TelegramEnabled bool           `gorm:"not null;default:false" json:"telegram_enabled"`
	TelegramChatID  string         `json:"telegram_chat_id"`
	ViberEnabled    bool           `gorm:"not null;default:false" json:"viber_enabled"`
	ViberUserID     string         `json:"viber_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
