package notifications

import (
	"log"

	"github.com/timebook/backend/internal/models"
	"gorm.io/gorm"
)

// Dispatcher sends notifications to users based on their preferences
type Dispatcher struct {
	db       *gorm.DB
	email    *EmailProvider
	telegram *TelegramProvider
	whatsapp *WhatsAppProvider
	viber    *ViberProvider
}

// NewDispatcher creates a notification dispatcher
func NewDispatcher(db *gorm.DB, email *EmailProvider, telegram *TelegramProvider, whatsapp *WhatsAppProvider, viber *ViberProvider) *Dispatcher {
	return &Dispatcher{
		db:       db,
		email:    email,
		telegram: telegram,
		whatsapp: whatsapp,
		viber:    viber,
	}
}

// SendAppointmentNotification sends a notification about an appointment (confirmed, rejected, etc.)
func (d *Dispatcher) SendAppointmentNotification(user *models.User, subject, body string, pref *models.NotificationPreferences) {
	if user == nil || user.ID == 0 {
		return
	}
	n := &Notification{
		UserEmail: user.Email,
		UserName:  user.Name,
		UserPhone: user.Phone,
		Subject:   subject,
		Body:      body,
		PlainBody: body,
	}
	if pref != nil {
		n.TelegramChatID = pref.TelegramChatID
		n.WhatsAppPhone = pref.WhatsAppPhone
		n.ViberUserID = pref.ViberUserID
	}

	// Email (default on if no prefs)
	emailEnabled := pref == nil || pref.EmailEnabled
	if emailEnabled && d.email != nil {
		if err := d.email.Send(n); err != nil {
			log.Printf("notification: email send failed: %v", err)
		}
	}

	// Telegram
	if pref != nil && pref.TelegramEnabled && pref.TelegramChatID != "" && d.telegram != nil {
		if err := d.telegram.Send(n); err != nil {
			log.Printf("notification: telegram send failed: %v", err)
		}
	}

	// WhatsApp
	if pref != nil && pref.WhatsAppEnabled && pref.WhatsAppPhone != "" && d.whatsapp != nil {
		if err := d.whatsapp.Send(n); err != nil {
			log.Printf("notification: whatsapp send failed: %v", err)
		}
	}

	// Viber
	if pref != nil && pref.ViberEnabled && pref.ViberUserID != "" && d.viber != nil {
		if err := d.viber.Send(n); err != nil {
			log.Printf("notification: viber send failed: %v", err)
		}
	}
}

// GetOrCreatePreferences returns notification preferences for a user, creating default if not exists
func (d *Dispatcher) GetOrCreatePreferences(userID uint) (*models.NotificationPreferences, error) {
	var pref models.NotificationPreferences
	err := d.db.Where("user_id = ?", userID).First(&pref).Error
	if err == gorm.ErrRecordNotFound {
		pref = models.NotificationPreferences{
			UserID:       userID,
			EmailEnabled: true,
		}
		if err := d.db.Create(&pref).Error; err != nil {
			return nil, err
		}
		return &pref, nil
	}
	if err != nil {
		return nil, err
	}
	return &pref, nil
}
